from __future__ import annotations

import io
import json
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Final

from sync_core import LogFormat, configure_logging

if TYPE_CHECKING:
    from collections.abc import Iterator

OUR_LOGGERS: Final = ("sync_api", "sync_core")


@contextmanager
def capturing_logs() -> Iterator[io.StringIO]:
    stream = io.StringIO()
    configure_logging(log_format=LogFormat.JSON, stream=stream)
    try:
        yield stream
    finally:
        configure_logging()


def entries(stream: io.StringIO) -> list[dict[str, Any]]:
    return [
        entry
        for line in stream.getvalue().splitlines()
        if line.strip()
        for entry in [json.loads(line)]
        if str(entry.get("logger", "")).startswith(OUR_LOGGERS)
    ]
