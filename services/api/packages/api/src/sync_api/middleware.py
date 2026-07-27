from __future__ import annotations

from time import perf_counter
from typing import TYPE_CHECKING, Final

from asgi_correlation_id import correlation_id

from sync_core import bind_request_context, clear_request_context, get_logger

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = get_logger(__name__)

REQUEST_ID_HEADER: Final = "X-Request-Id"

UNSENT_STATUS: Final = 500


def request_id() -> str | None:
    return correlation_id.get()


class AccessLogMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        clear_request_context()
        bind_request_context(request_id=request_id())

        status_code = UNSENT_STATUS
        started = perf_counter()

        async def note_status(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, note_status)
        except Exception:
            logger.error(
                "request.failed",
                method=scope["method"],
                path=scope["path"],
                duration_ms=elapsed_ms(started),
            )
            raise
        else:
            logger.info(
                "request.finished",
                method=scope["method"],
                path=scope["path"],
                status_code=status_code,
                duration_ms=elapsed_ms(started),
            )
            clear_request_context()


def elapsed_ms(started: float) -> float:
    return round((perf_counter() - started) * 1000, 3)
