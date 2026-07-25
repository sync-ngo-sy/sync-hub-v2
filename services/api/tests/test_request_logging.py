"""Every request gets an id, and every log line emitted while serving it carries that id."""

from __future__ import annotations

import io
import json
from collections.abc import Iterator
from typing import Any

import pytest
from httpx import AsyncClient

from sync_core import LogFormat, configure_logging


@pytest.fixture
def log_stream() -> Iterator[io.StringIO]:
    """Redirect the process-wide log handler into a buffer for the duration of a test."""
    stream = io.StringIO()
    configure_logging(log_format=LogFormat.JSON, stream=stream)
    yield stream
    configure_logging()


def entries(stream: io.StringIO) -> list[dict[str, Any]]:
    """The service's own log lines, JSON-decoded. Skips libraries logging on our handler."""
    return [
        entry
        for line in stream.getvalue().splitlines()
        if line.strip()
        for entry in [json.loads(line)]
        if str(entry.get("logger", "")).startswith(("sync_api", "sync_core"))
    ]


async def test_response_carries_a_request_id(client: AsyncClient) -> None:
    response = await client.get("/v1/health")

    assert response.headers["x-request-id"]


async def test_each_request_gets_its_own_id(client: AsyncClient) -> None:
    first = await client.get("/v1/health")
    second = await client.get("/v1/health")

    assert first.headers["x-request-id"] != second.headers["x-request-id"]


async def test_a_supplied_request_id_is_kept(client: AsyncClient) -> None:
    response = await client.get("/v1/health", headers={"X-Request-Id": "from-the-gateway"})

    assert response.headers["x-request-id"] == "from-the-gateway"


async def test_logs_are_json_carrying_the_request_id(
    client: AsyncClient, log_stream: io.StringIO
) -> None:
    response = await client.get("/v1/health", headers={"X-Request-Id": "correlate-me"})

    request_logs = [entry for entry in entries(log_stream) if entry.get("request_id")]
    assert request_logs, "the request logged nothing"
    assert {entry["request_id"] for entry in request_logs} == {"correlate-me"}
    assert response.headers["x-request-id"] == "correlate-me"


async def test_request_logs_describe_the_request(
    client: AsyncClient, log_stream: io.StringIO
) -> None:
    await client.get("/v1/health")

    completed = [entry for entry in entries(log_stream) if entry.get("event") == "request.finished"]
    assert len(completed) == 1
    assert completed[0]["method"] == "GET"
    assert completed[0]["path"] == "/v1/health"
    assert completed[0]["status_code"] == 200
    assert completed[0]["duration_ms"] >= 0


async def test_a_failing_request_logs_its_traceback_once_under_its_request_id(
    failing_client: AsyncClient, log_stream: io.StringIO
) -> None:
    """The error handler runs outside the middleware; it must still know the request id.

    Without this, an operator handed a request id by the 500 response finds every line
    about that request except the one carrying the traceback.
    """
    response = await failing_client.get("/v1/demo/boom", headers={"X-Request-Id": "trace-me"})
    assert response.status_code == 500

    logged = entries(log_stream)
    assert [entry["event"] for entry in logged] == ["request.failed", "request.unhandled_error"]
    assert {entry["request_id"] for entry in logged} == {"trace-me"}

    with_traceback = [entry for entry in logged if "exception" in entry]
    assert len(with_traceback) == 1
    assert "hunter2" in with_traceback[0]["exception"]


async def test_request_context_does_not_leak_between_requests(
    client: AsyncClient, log_stream: io.StringIO
) -> None:
    await client.get("/v1/health", headers={"X-Request-Id": "first"})
    await client.get("/v1/health", headers={"X-Request-Id": "second"})

    finished = [entry for entry in entries(log_stream) if entry.get("event") == "request.finished"]
    assert [entry["request_id"] for entry in finished] == ["first", "second"]
