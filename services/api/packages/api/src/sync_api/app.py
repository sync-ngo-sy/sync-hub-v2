from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import Depends, FastAPI

from sync_api.auth import Authentication
from sync_api.csrf import CSRF_HEADER, enforce_csrf_header
from sync_api.errors import PROBLEM_RESPONSES, install_problem_handlers, use_problem_media_type
from sync_api.middleware import REQUEST_ID_HEADER, AccessLogMiddleware
from sync_api.rate_limit import build_auth_rate_limiter, build_public_rate_limiter
from sync_api.routes import (
    applications,
    auth,
    candidates,
    cvs,
    health,
    jobs,
    notifications,
    search,
    tenant_applications,
    tenant_jobs,
    tenants,
)
from sync_core import Database, Settings, Storage, configure_logging, get_logger, get_settings
from sync_rag.openai_embedder import OpenAiEmbedder

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sync_rag import Embedder

logger = get_logger(__name__)

API_PREFIX = "/v1"

DESCRIPTION = f"""\
The Sync recruitment platform's backend. Every error is an RFC 9457 problem+json document.

Sessions are httpOnly cookies the API sets on sign-in; send requests with credentials and
never read a token. Every request that changes data must carry a `{CSRF_HEADER}` header —
any value — which together with `SameSite` is what stops another origin forging one.
"""


def create_app(settings: Settings | None = None, embedder: Embedder | None = None) -> FastAPI:
    resolved = settings or get_settings()
    configure_logging(level=resolved.log_level, log_format=resolved.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        database = Database(resolved)
        authentication = Authentication.build(
            resolved, refresh_cookie_path=f"{API_PREFIX}{auth.ROUTER_PREFIX}"
        )
        storage = Storage.build(resolved)
        app.state.settings = resolved
        app.state.database = database
        app.state.authentication = authentication
        app.state.storage = storage
        app.state.embedder = embedder or _openai_embedder(resolved)
        app.state.auth_rate_limiter = build_auth_rate_limiter(resolved)
        app.state.public_rate_limiter = build_public_rate_limiter(resolved)
        logger.info("api.started", environment=resolved.environment.value)
        try:
            yield
        finally:
            await authentication.aclose()
            await storage.aclose()
            await database.dispose()
            logger.info("api.stopped")

    app = FastAPI(
        title="Sync API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        responses=PROBLEM_RESPONSES,
        dependencies=[Depends(enforce_csrf_header)],
    )

    # Added innermost first — Starlette treats the last one added as the outermost — so the
    # access log runs inside the request id it reports.
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(
        # A caller's own id is echoed as sent; the library would otherwise replace anything that
        # is not a UUID4, breaking correlation with upstream tracing.
        CorrelationIdMiddleware,
        header_name=REQUEST_ID_HEADER,
        validator=None,
    )
    install_problem_handlers(app)
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(tenants.router, prefix=API_PREFIX)
    app.include_router(candidates.router, prefix=API_PREFIX)
    app.include_router(cvs.router, prefix=API_PREFIX)
    app.include_router(notifications.router, prefix=API_PREFIX)
    app.include_router(search.router, prefix=API_PREFIX)
    app.include_router(tenant_jobs.router, prefix=API_PREFIX)
    app.include_router(tenant_applications.router, prefix=API_PREFIX)
    app.include_router(jobs.router, prefix=API_PREFIX)
    app.include_router(applications.router, prefix=API_PREFIX)

    describe_with_fastapis_defaults = app.openapi

    def openapi() -> dict[str, Any]:
        return use_problem_media_type(describe_with_fastapis_defaults())

    app.openapi = openapi  # type: ignore[method-assign]

    return app


def _openai_embedder(settings: Settings) -> Embedder | None:
    if settings.openai_api_key is None:
        return None
    return OpenAiEmbedder.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_embedding_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )
