"""The worker as an HTTP service, so it can scale to zero between bursts.

Two callers: a database webhook fired on enqueue, for sub-second latency, and a schedule
every few minutes, which is what actually guarantees nothing is stranded. Neither can mint a
Google identity token, so the endpoints are held behind a shared secret rather than IAM.
"""

from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel

from sync_core import configure_logging, get_logger, get_settings
from sync_worker.worker import Worker

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sync_core import Settings
    from sync_worker.runner import DrainReport

logger = get_logger(__name__)

SECRET_HEADER = "X-Worker-Secret"


class DrainResponse(BaseModel):
    processed: dict[str, int]
    swept: dict[str, int]
    truncated: list[str]
    total_processed: int
    total_swept: int

    @classmethod
    def of(cls, report: DrainReport) -> DrainResponse:
        return cls(
            processed=report.processed,
            swept=report.swept,
            truncated=report.truncated,
            total_processed=report.total_processed,
            total_swept=report.total_swept,
        )


def _worker_of(request: Request) -> Worker:
    return request.app.state.worker  # pyright: ignore[reportAny]


def _settings_of(request: Request) -> Settings:
    return request.app.state.settings  # pyright: ignore[reportAny]


async def require_secret(
    request: Request,
    secret: Annotated[str | None, Header(alias=SECRET_HEADER)] = None,
) -> None:
    """Reject anything without the shared secret, and refuse to serve without one set.

    Failing closed matters more than usual here: an unauthenticated drain endpoint is a free
    way to make someone else's OpenAI calls.
    """
    expected = _settings_of(request).worker_shared_secret
    if expected is None:
        logger.error("worker.secret_not_configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SYNC_WORKER_SHARED_SECRET is not set; refusing to serve.",
        )
    if secret is None or not secrets.compare_digest(secret, expected.get_secret_value()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="bad secret")


def create_app(settings: Settings | None = None, worker: Worker | None = None) -> FastAPI:
    resolved = settings or get_settings()
    configure_logging(level=resolved.log_level, log_format=resolved.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        app.state.settings = resolved
        # Built once per instance rather than per request: the engines hold the database pool
        # and the model clients, and a cold start pays for them already.
        app.state.worker = worker or Worker(resolved)
        logger.info("worker.service_started", environment=resolved.environment.value)
        try:
            yield
        finally:
            if worker is None:
                await app.state.worker.aclose()
            logger.info("worker.service_stopped")

    app = FastAPI(title="Sync Hub worker", lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/drain", dependencies=[Depends(require_secret)])
    async def drain(request: Request) -> DrainResponse:
        report = await _worker_of(request).drain()
        logger.info("worker.drained", processed=report.processed, truncated=report.truncated)
        return DrainResponse.of(report)

    @app.post("/scheduled", dependencies=[Depends(require_secret)])
    async def scheduled(request: Request) -> DrainResponse:
        report = await _worker_of(request).scheduled()
        logger.info(
            "worker.scheduled",
            processed=report.processed,
            swept=report.swept,
            truncated=report.truncated,
        )
        return DrainResponse.of(report)

    return app
