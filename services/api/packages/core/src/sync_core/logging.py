"""Structured logging for every process in the service.

One handler on the root logger renders everything — our own structlog events and the
foreign records emitted by uvicorn, SQLAlchemy and friends — through the same processor
chain, so a deployment gets one parseable stream rather than two interleaved formats.

Anything bound with `bind_request_context()` rides along on every line logged for the rest
of that request, including lines logged by libraries that know nothing about it.
"""

from __future__ import annotations

import logging
from typing import IO, Any

import structlog

from sync_core.settings import LogFormat, LogLevel

REQUEST_ID_KEY = "request_id"

# Shared by structlog's own chain and by `foreign_pre_chain`, so a uvicorn record and one
# of our events carry the same keys.
_SHARED_PROCESSORS: list[structlog.typing.Processor] = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_logger_name,
    structlog.stdlib.add_log_level,
    structlog.processors.TimeStamper(fmt="iso", utc=True),
    structlog.processors.StackInfoRenderer(),
    structlog.processors.UnicodeDecoder(),
]

# uvicorn installs its own colourising handlers; they would print every record a second
# time in its own format. Clearing them lets the records propagate to our root handler.
_LOGGERS_TO_UNSTYLE = ("uvicorn", "uvicorn.error", "uvicorn.access")


def configure_logging(
    *,
    level: LogLevel = LogLevel.INFO,
    log_format: LogFormat = LogFormat.JSON,
    stream: IO[str] | None = None,
) -> None:
    """Point all logging at one structlog-rendered handler. Safe to call more than once.

    `stream` defaults to stderr; tests pass a buffer to read back what was rendered.
    """
    renderer: structlog.typing.Processor = (
        structlog.processors.JSONRenderer()
        if log_format is LogFormat.JSON
        else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[
            *_SHARED_PROCESSORS,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    handler = logging.StreamHandler(stream)
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=_SHARED_PROCESSORS,
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.processors.format_exc_info,
                renderer,
            ],
        )
    )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.value)

    for name in _LOGGERS_TO_UNSTYLE:
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """A logger whose events carry whatever request context is currently bound."""
    return structlog.stdlib.get_logger(name)


def bind_request_context(**values: Any) -> None:
    """Attach values to every log line emitted from here until `clear_request_context()`.

    Bound in a contextvar, so concurrent requests never see each other's context.
    """
    structlog.contextvars.bind_contextvars(**values)


def clear_request_context() -> None:
    """Drop everything `bind_request_context()` bound in this context."""
    structlog.contextvars.clear_contextvars()
