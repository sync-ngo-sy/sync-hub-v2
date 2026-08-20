from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

from asgi_correlation_id import CorrelationIdMiddleware
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sync_api.auth import Authentication
from sync_api.csrf import CSRF_HEADER, enforce_csrf_header
from sync_api.errors import PROBLEM_RESPONSES, install_problem_handlers, use_problem_media_type
from sync_api.middleware import REQUEST_ID_HEADER, AccessLogMiddleware
from sync_api.rate_limit import (
    build_access_request_rate_limiter,
    build_assessment_rate_limiter,
    build_auth_rate_limiter,
    build_candidate_record_rate_limiter,
    build_cv_upload_rate_limiter,
    build_directory_rate_limiter,
    build_public_rate_limiter,
    build_search_rate_limiter,
)
from sync_api.routes import (
    access_requests,
    applications,
    auth,
    candidates,
    cvs,
    directory,
    health,
    jobs,
    notifications,
    platform,
    reference,
    search,
    tenant_applications,
    tenant_candidates,
    tenant_jobs,
    tenant_message_templates,
    tenant_stats,
    tenant_tags,
    tenant_talent_pool,
    tenant_tracked_links,
    tenants,
)
from sync_assessments.openai_assessor import OpenAiMatchAssessor
from sync_core import (
    AVATAR_BUCKET,
    TENANT_LOGO_BUCKET,
    Database,
    Settings,
    Storage,
    configure_logging,
    documentation_urls,
    get_logger,
    get_settings,
)
from sync_rag.openai_embedder import OpenAiEmbedder

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sync_assessments import MatchAssessor
    from sync_rag import Embedder

logger = get_logger(__name__)

API_PREFIX = "/v1"

DESCRIPTION = f"""\
The Sync Hub recruitment platform's backend. Every error is an RFC 9457 problem+json document.

Sessions are httpOnly cookies the API sets on sign-in; send requests with credentials and
never read a token. Every request that changes data must carry a `{CSRF_HEADER}` header —
any value — which together with `SameSite` is what stops another origin forging one.
"""


def create_app(
    settings: Settings | None = None,
    embedder: Embedder | None = None,
    assessor: MatchAssessor | None = None,
) -> FastAPI:
    resolved = settings or get_settings()
    configure_logging(level=resolved.log_level, log_format=resolved.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        database = Database(resolved)
        authentication = Authentication.build(
            resolved, refresh_cookie_path=f"{API_PREFIX}{auth.ROUTER_PREFIX}"
        )
        storage = Storage.build(resolved)
        avatar_storage = Storage.build(resolved, bucket=AVATAR_BUCKET)
        tenant_logo_storage = Storage.build(resolved, bucket=TENANT_LOGO_BUCKET)
        app.state.settings = resolved
        app.state.database = database
        app.state.authentication = authentication
        app.state.storage = storage
        app.state.avatar_storage = avatar_storage
        app.state.tenant_logo_storage = tenant_logo_storage
        app.state.embedder = embedder or _openai_embedder(resolved)
        app.state.assessor = assessor or _openai_assessor(resolved)
        app.state.auth_rate_limiter = build_auth_rate_limiter(resolved)
        app.state.public_rate_limiter = build_public_rate_limiter(resolved)
        app.state.assessment_rate_limiter = build_assessment_rate_limiter(resolved)
        app.state.access_request_rate_limiter = build_access_request_rate_limiter(resolved)
        app.state.directory_rate_limiter = build_directory_rate_limiter(resolved)
        app.state.candidate_record_rate_limiter = build_candidate_record_rate_limiter(resolved)
        app.state.search_rate_limiter = build_search_rate_limiter(resolved)
        app.state.cv_upload_rate_limiter = build_cv_upload_rate_limiter(resolved)
        logger.info("api.started", environment=resolved.environment.value)
        try:
            yield
        finally:
            await authentication.aclose()
            await storage.aclose()
            await avatar_storage.aclose()
            await tenant_logo_storage.aclose()
            await database.dispose()
            logger.info("api.stopped")

    app = FastAPI(
        title="Sync Hub API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        responses=PROBLEM_RESPONSES,
        dependencies=[Depends(enforce_csrf_header)],
        **documentation_urls(resolved),
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
    # Outermost, so preflight is answered without touching the app and so the headers reach
    # error responses too — a 401 without them reads as a CORS failure in the browser console
    # and sends whoever is debugging in the wrong direction.
    #
    # No allow_origin_regex and no wildcard: with credentials the browser rejects `*` outright,
    # and echoing back whatever asked would defeat the allowlist.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved.cors_allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"],
        # The CSRF header the app requires on every write, so preflight has to permit it or no
        # cross-origin write can be sent at all.
        allow_headers=[CSRF_HEADER, REQUEST_ID_HEADER, "Content-Type", "Accept"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    install_problem_handlers(app)
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(auth.router, prefix=API_PREFIX)
    app.include_router(tenants.router, prefix=API_PREFIX)
    app.include_router(access_requests.router, prefix=API_PREFIX)
    app.include_router(platform.router, prefix=API_PREFIX)
    app.include_router(candidates.router, prefix=API_PREFIX)
    app.include_router(cvs.router, prefix=API_PREFIX)
    app.include_router(directory.router, prefix=API_PREFIX)
    app.include_router(notifications.router, prefix=API_PREFIX)
    app.include_router(reference.router, prefix=API_PREFIX)
    app.include_router(search.router, prefix=API_PREFIX)
    app.include_router(tenant_tags.router, prefix=API_PREFIX)
    app.include_router(tenant_message_templates.router, prefix=API_PREFIX)
    app.include_router(tenant_candidates.router, prefix=API_PREFIX)
    app.include_router(tenant_talent_pool.router, prefix=API_PREFIX)
    app.include_router(tenant_jobs.router, prefix=API_PREFIX)
    app.include_router(tenant_applications.router, prefix=API_PREFIX)
    app.include_router(tenant_stats.router, prefix=API_PREFIX)
    app.include_router(tenant_tracked_links.router, prefix=API_PREFIX)
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


def _openai_assessor(settings: Settings) -> MatchAssessor | None:
    if settings.openai_api_key is None:
        return None
    return OpenAiMatchAssessor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_assessment_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )
