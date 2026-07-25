"""Assembling the FastAPI application.

`create_app` builds a fully independent app every call — nothing module-level is shared —
so a test can stand one up with its own settings without disturbing the others.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

from fastapi import FastAPI

from sync_api.errors import PROBLEM_RESPONSES, install_problem_handlers, use_problem_media_type
from sync_api.middleware import RequestContextMiddleware
from sync_api.routes import health
from sync_core import Database, Settings, configure_logging, get_logger, get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

logger = get_logger(__name__)

API_PREFIX = "/v1"

DESCRIPTION = """\
The Sync recruitment platform's backend. Every error is an RFC 9457 problem+json document.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or get_settings()
    configure_logging(level=resolved.log_level, log_format=resolved.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        database = Database(resolved)
        app.state.database = database
        logger.info("api.started", environment=resolved.environment.value)
        try:
            yield
        finally:
            await database.dispose()
            logger.info("api.stopped")

    app = FastAPI(
        title="Sync API",
        version="0.1.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        responses=PROBLEM_RESPONSES,
    )

    app.add_middleware(RequestContextMiddleware)
    install_problem_handlers(app)
    app.include_router(health.router, prefix=API_PREFIX)

    describe_with_fastapis_defaults = app.openapi

    def openapi() -> dict[str, Any]:
        return use_problem_media_type(describe_with_fastapis_defaults())

    app.openapi = openapi  # type: ignore[method-assign]

    return app
