"""Cloud Logging reads `severity`; structlog writes `level`. Nothing joined the two.

Every line this system has shipped arrived with no severity, so an unhandled exception sorted
exactly like a health check and `severity>=ERROR` matched nothing at all. The monitoring built in
#312 counts named events precisely because filtering by level was not available.

These tests are cheap and the gap was invisible for the life of the project, which is the argument
for having them.
"""

from __future__ import annotations

import io
import json
from typing import TYPE_CHECKING, Any

import pytest

from sync_core import LogFormat, configure_logging, get_logger
from sync_core.settings import LogLevel

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture
def stream() -> Iterator[io.StringIO]:
    captured = io.StringIO()
    # DEBUG, or the debug case below is filtered before it reaches a processor and the test
    # passes by proving nothing.
    configure_logging(level=LogLevel.DEBUG, log_format=LogFormat.JSON, stream=captured)
    yield captured
    configure_logging()


def lines(captured: io.StringIO) -> list[dict[str, Any]]:
    return [json.loads(line) for line in captured.getvalue().splitlines() if line.strip()]


@pytest.mark.parametrize(
    ("emit", "expected"),
    [
        ("debug", "DEBUG"),
        ("info", "INFO"),
        ("warning", "WARNING"),
        ("error", "ERROR"),
        ("critical", "CRITICAL"),
    ],
)
def test_each_level_becomes_the_severity_cloud_logging_reads(
    stream: io.StringIO, emit: str, expected: str
) -> None:
    getattr(get_logger("sync_core.test"), emit)("some.event")

    entry = lines(stream)[-1]
    assert entry["severity"] == expected


def test_an_exception_is_an_error_rather_than_unsorted(stream: io.StringIO) -> None:
    """`logger.exception` is how every unhandled failure is recorded. Losing it loses the lot."""
    try:
        raise ValueError("boom")
    except ValueError:
        get_logger("sync_core.test").exception("something.broke")

    entry = lines(stream)[-1]
    assert entry["severity"] == "ERROR"


def test_event_survives_because_the_alerts_select_on_it(stream: io.StringIO) -> None:
    """The log-based metrics filter `jsonPayload.event`. Renaming it would silence them."""
    get_logger("sync_core.test").info("worker.scheduled", processed={"ingestion": 0})

    entry = lines(stream)[-1]
    assert entry["event"] == "worker.scheduled"
    assert entry["message"] == "worker.scheduled"


def test_the_console_is_left_alone(stream: io.StringIO) -> None:
    """A person reading a terminal gets colour by level; the extra keys would just be noise."""
    console = io.StringIO()
    configure_logging(log_format=LogFormat.CONSOLE, stream=console)
    get_logger("sync_core.test").info("some.event")

    assert "severity" not in console.getvalue()
