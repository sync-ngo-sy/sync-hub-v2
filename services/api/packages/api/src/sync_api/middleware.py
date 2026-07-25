"""How a request ended, recorded once, under the id the client was handed.

The id is `asgi-correlation-id`'s job — reading it off the request, generating one when it
is absent, echoing it back, holding it in a contextvar. What is left here is the half no
library supplies: one line per request saying what it was, how it ended, how long it took.

Raw ASGI rather than `BaseHTTPMiddleware` so it reads the status without buffering the
body, and so an exception passes through untouched on its way to the error handler.
"""

from __future__ import annotations

from time import perf_counter
from typing import TYPE_CHECKING, Final

from asgi_correlation_id import correlation_id

from sync_core import bind_request_context, clear_request_context, get_logger

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = get_logger(__name__)

#: The one spelling of the header, for both directions. Starlette matches case-insensitively.
REQUEST_ID_HEADER: Final = "X-Request-Id"

#: Status reported for a request that died before sending a response line.
UNSENT_STATUS: Final = 500


def request_id() -> str | None:
    """The id bound for this request, readable from any handler.

    A contextvar reaches further than `scope["state"]` did: Starlette's outermost error
    handler builds its response outside every middleware, and still has to name the id the
    client was handed.
    """
    return correlation_id.get()


class AccessLogMiddleware:
    """Log how the request ended, with the request id on the line."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Cleared on the way in as well as out, so a task reused for the next request on a
        # keep-alive connection can never inherit the last one's context.
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
            # The traceback belongs to the error handler, which sees the exception itself.
            # This line only records that the request ended badly, and how long it took.
            logger.error(
                "request.failed",
                method=scope["method"],
                path=scope["path"],
                duration_ms=elapsed_ms(started),
            )
            # Deliberately left bound: Starlette's outermost error handler runs *after* this
            # middleware unwinds, and its traceback has to land under the same request id
            # the client was handed. The next request clears this on its way in.
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
