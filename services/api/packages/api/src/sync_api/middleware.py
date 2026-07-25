"""Per-request context: an id that reaches the client, the logs, and the error responses.

Written as raw ASGI rather than `BaseHTTPMiddleware` so the id lands in `scope["state"]`
before anything else runs — Starlette's outermost error handler builds its response
outside this middleware and reads the id from there.
"""

from __future__ import annotations

from time import perf_counter
from typing import TYPE_CHECKING
from uuid import uuid4

from starlette.datastructures import Headers, MutableHeaders

from sync_core import bind_request_context, clear_request_context, get_logger

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = get_logger(__name__)

#: The one spelling of the header, for both directions. Starlette matches case-insensitively.
REQUEST_ID_HEADER = "X-Request-Id"

#: Status reported for a request that died before sending a response line.
UNSENT_STATUS = 500


class RequestContextMiddleware:
    """Bind a request id for the life of the request, and log how the request ended."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = Headers(scope=scope).get(REQUEST_ID_HEADER) or str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        # Cleared on the way in as well as out, so a task reused for the next request on a
        # keep-alive connection can never inherit the last one's context.
        clear_request_context()
        bind_request_context(request_id=request_id)

        status_code = UNSENT_STATUS
        started = perf_counter()

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
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
