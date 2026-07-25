"""Assembling the FastAPI application.

`create_app` builds a fully independent app every call — nothing module-level is shared —
so a test can stand one up with its own settings without disturbing the others.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import Depends, FastAPI

from sync_api.auth import Authentication
from sync_api.csrf import CSRF_HEADER, enforce_csrf_header
from sync_api.errors import PROBLEM_RESPONSES, install_problem_handlers, use_problem_media_type
from sync_api.middleware import REQUEST_ID_HEADER, AccessLogMiddleware
from sync_api.rate_limit import build_auth_rate_limiter
from sync_api.routes import auth, health
from sync_core import Database, Settings, configure_logging, get_logger, get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

logger = get_logger(__name__)

API_PREFIX = "/v1"

DESCRIPTION = f"""\
The Sync recruitment platform's backend. Every error is an RFC 9457 problem+json document.

Sessions are httpOnly cookies the API sets on sign-in; send requests with credentials and
never read a token. Every request that changes data must carry a `{CSRF_HEADER}` header —
any value — which together with `SameSite` is what stops another origin forging one.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or get_settings()
    configure_logging(level=resolved.log_level, log_format=resolved.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        database = Database(resolved)
        authentication = Authentication.build(
            resolved, refresh_cookie_path=f"{API_PREFIX}{auth.ROUTER_PREFIX}"
        )
        app.state.database = database
        app.state.authentication = authentication
        app.state.auth_rate_limiter = build_auth_rate_limiter(resolved)
        logger.info("api.started", environment=resolved.environment.value)
        try:
            yield
        finally:
            await authentication.aclose()
            await database.dispose()
            logger.info("api.stopped")

    app = FastAPI(
        title="Sync API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        responses=PROBLEM_RESPONSES,
        # Application-wide so no future route can forget it, and a dependency rather than
        # middleware so it runs after routing — a POST to a GET-only path stays a 405.
        dependencies=[Depends(enforce_csrf_header)],
    )

    # Added innermost first: Starlette treats the last one added as the outermost, and the
    # access log has to run inside the id it reports.
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(
        CorrelationIdMiddleware,
        header_name=REQUEST_ID_HEADER,
        # A caller's own id is echoed as sent. The library defaults to replacing anything
        # that is not a UUID4, which would break correlation with any upstream tracing that
        # numbers its requests differently.
        validator=None,
    )
    install_problem_handlers(app)
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)

    describe_with_fastapis_defaults = app.openapi

    def openapi() -> dict[str, Any]:
        return use_problem_media_type(describe_with_fastapis_defaults())

    app.openapi = openapi  # type: ignore[method-assign]

    return app
