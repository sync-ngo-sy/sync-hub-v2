from __future__ import annotations

import logging
from typing import IO, Any

import structlog

from sync_core.settings import LogFormat, LogLevel

REQUEST_ID_KEY = "request_id"

_SHARED_PROCESSORS: list[structlog.typing.Processor] = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.add_logger_name,
    structlog.stdlib.add_log_level,
    structlog.processors.TimeStamper(fmt="iso", utc=True),
    structlog.processors.StackInfoRenderer(),
    structlog.processors.UnicodeDecoder(),
]

_LOGGERS_TO_UNSTYLE = ("uvicorn", "uvicorn.error", "uvicorn.access")

# Cloud Logging reads the level from `severity`, and structlog writes it to `level`. Nothing
# reconciles the two, so every line we have ever shipped arrived with no severity at all: an
# unhandled exception and a health check sort identically, `severity>=ERROR` matches nothing,
# and the console's error view is permanently empty.
#
# It also reads `message` for the one line it shows in a collapsed entry. `event` stays where it
# is -- alert filters and tests select on it -- so this mirrors rather than renames.
_CLOUD_SEVERITY: dict[str, str] = {
    "debug": "DEBUG",
    "info": "INFO",
    "warning": "WARNING",
    "warn": "WARNING",
    "error": "ERROR",
    "exception": "ERROR",
    "critical": "CRITICAL",
    "fatal": "CRITICAL",
}


def _for_cloud_logging(
    _logger: Any, _name: str, event_dict: structlog.typing.EventDict
) -> structlog.typing.EventDict:
    level = str(event_dict.get("level", "")).lower()
    event_dict["severity"] = _CLOUD_SEVERITY.get(level, "DEFAULT")

    event = event_dict.get("event")
    if event is not None:
        event_dict["message"] = event

    return event_dict


def configure_logging(
    *,
    level: LogLevel = LogLevel.INFO,
    log_format: LogFormat = LogFormat.JSON,
    stream: IO[str] | None = None,
) -> None:
    json_output = log_format is LogFormat.JSON
    renderer: structlog.typing.Processor = (
        structlog.processors.JSONRenderer() if json_output else structlog.dev.ConsoleRenderer()
    )

    # Only for JSON. On a console the fields are noise, and ConsoleRenderer already colours by
    # level -- which is the same information, for the only reader who is a person.
    for_cloud: list[structlog.typing.Processor] = [_for_cloud_logging] if json_output else []

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
                *for_cloud,
                renderer,
            ],
        )
    )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.value)

    # uvicorn's own colourising handlers would print every record a second time; clearing
    # them lets the records propagate to our root handler instead.
    for name in _LOGGERS_TO_UNSTYLE:
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.stdlib.get_logger(name)


def bind_request_context(**values: Any) -> None:
    structlog.contextvars.bind_contextvars(**values)


def clear_request_context() -> None:
    structlog.contextvars.clear_contextvars()
