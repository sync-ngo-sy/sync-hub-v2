"""The drain endpoints, with the Worker replaced by a stub.

Covers what the transport owes: nothing runs without the shared secret, the service refuses
to serve at all without one configured, concurrent calls are safe, and the scheduled entry
point sweeps *and* drains — which is the whole reason a dropped webhook is survivable.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from sync_core import Settings
from sync_worker.runner import DrainReport
from sync_worker.service import SECRET_HEADER, create_app

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

SECRET = "a-shared-secret"
BASE_URL = "http://worker"


class StubWorker:
    """Records the order of calls, because sweep-before-drain is the correctness property."""

    def __init__(self, pending: int = 0, stuck: int = 0) -> None:
        self.pending = pending
        self.stuck = stuck
        self.calls: list[str] = []
        self.in_flight = 0
        self.peak_in_flight = 0

    async def drain(self) -> DrainReport:
        self.calls.append("drain")
        self.in_flight += 1
        self.peak_in_flight = max(self.peak_in_flight, self.in_flight)
        try:
            await asyncio.sleep(0.02)
            drained, self.pending = self.pending, 0
            return DrainReport(processed={"ingestion": drained})
        finally:
            self.in_flight -= 1

    async def sweep(self) -> dict[str, int]:
        self.calls.append("sweep")
        # What a sweep does: rows abandoned mid-processing go back to pending, where only a
        # drain will pick them up.
        released, self.stuck = self.stuck, 0
        self.pending += released
        return {"ingestion": released}

    async def scheduled(self) -> DrainReport:
        swept = await self.sweep()
        drained = await self.drain()
        return DrainReport(processed=drained.processed, swept=swept)

    async def aclose(self) -> None:  # pragma: no cover - the app never closes an injected one
        return None


@asynccontextmanager
async def _client(settings: Settings, worker: StubWorker) -> AsyncGenerator[AsyncClient]:
    app = create_app(settings=settings, worker=worker)  # pyright: ignore[reportArgumentType]
    async with (
        LifespanManager(app),
        AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as client,
    ):
        yield client


@pytest.fixture
def worker_settings() -> Settings:
    # Explicit rather than from the environment: these tests must not depend on a local .env.
    return Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue] -- accepted at run time
        database_url="postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
        supabase_url="http://127.0.0.1:54321",
        supabase_service_role_key=SecretStr("service-role"),
        supabase_anon_key=SecretStr("anon"),
        recruiter_portal_url="http://127.0.0.1:5174",
        admin_portal_url="http://127.0.0.1:5175",
    )  # pyright: ignore[reportCallIssue, reportArgumentType]


@pytest.fixture
def secured(worker_settings: Settings) -> Settings:
    return worker_settings.model_copy(update={"worker_shared_secret": SecretStr(SECRET)})


async def test_health_needs_no_secret(secured: Settings) -> None:
    async with _client(secured, StubWorker()) as client:
        response = await client.get("/health")

    assert response.status_code == 200


@pytest.mark.parametrize(
    "headers",
    [
        pytest.param({}, id="no header"),
        pytest.param({SECRET_HEADER: "wrong"}, id="wrong secret"),
        pytest.param({SECRET_HEADER: ""}, id="empty secret"),
    ],
)
async def test_draining_is_refused_without_the_secret(
    secured: Settings, headers: dict[str, str]
) -> None:
    worker = StubWorker(pending=3)
    async with _client(secured, worker) as client:
        response = await client.post("/drain", headers=headers)

    assert response.status_code == 401
    assert worker.calls == []


async def test_the_service_refuses_to_serve_without_a_secret_configured(
    worker_settings: Settings,
) -> None:
    worker = StubWorker(pending=3)
    async with _client(worker_settings, worker) as client:
        response = await client.post("/drain", headers={SECRET_HEADER: SECRET})

    assert response.status_code == 503
    assert worker.calls == []


async def test_draining_reports_what_it_processed(secured: Settings) -> None:
    async with _client(secured, StubWorker(pending=4)) as client:
        response = await client.post("/drain", headers={SECRET_HEADER: SECRET})

    assert response.status_code == 200
    assert response.json()["processed"] == {"ingestion": 4}
    assert response.json()["total_processed"] == 4


async def test_the_scheduled_call_sweeps_before_draining(secured: Settings) -> None:
    worker = StubWorker(pending=0, stuck=2)
    async with _client(secured, worker) as client:
        response = await client.post("/scheduled", headers={SECRET_HEADER: SECRET})

    assert worker.calls == ["sweep", "drain"]
    body: dict[str, Any] = response.json()
    assert body["swept"] == {"ingestion": 2}
    # Swept rows are only pending afterwards, and a drain is the only thing that finishes a
    # pending row. The stub has no retry delay, so here that drain is this same call.
    assert body["processed"] == {"ingestion": 2}


async def test_a_dropped_notification_is_recovered_by_the_scheduled_call(
    secured: Settings,
) -> None:
    """No webhook ever arrives for this row; the schedule alone has to finish it."""
    worker = StubWorker(pending=1)
    async with _client(secured, worker) as client:
        response = await client.post("/scheduled", headers={SECRET_HEADER: SECRET})

    assert response.json()["total_processed"] == 1
    assert worker.pending == 0


async def test_concurrent_calls_are_safe(secured: Settings) -> None:
    worker = StubWorker(pending=6)
    async with _client(secured, worker) as client:
        responses = await asyncio.gather(
            *(client.post("/drain", headers={SECRET_HEADER: SECRET}) for _ in range(4))
        )

    assert [response.status_code for response in responses] == [200] * 4
    # Six rows, four callers, and no row processed twice: whoever claims first wins and the
    # rest find an empty queue.
    assert sum(response.json()["total_processed"] for response in responses) == 6
    assert worker.peak_in_flight > 1
