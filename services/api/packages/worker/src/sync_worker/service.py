"""The worker as an HTTP service, so it can scale to zero between bursts.

Two callers: a database webhook fired on enqueue, for sub-second latency, and a schedule
every few minutes, which is what actually guarantees nothing is stranded.

They authenticate differently, because they can. The schedule signs a Google token scoped to
this service; the webhook is Postgres calling out, which cannot mint one, so it carries a shared
secret instead. Both are checked in the application rather than by Cloud Run's IAM, because the
webhook needs the service to stay publicly invocable.
"""

from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from pydantic import BaseModel

from sync_core import configure_logging, get_logger, get_settings
from sync_worker.oidc import OidcRejectedError, SchedulerTokens
from sync_worker.worker import Worker

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from sync_core import Settings
    from sync_worker.runner import DrainReport

logger = get_logger(__name__)

SECRET_HEADER = "X-Worker-Secret"


class DrainResponse(BaseModel):
    processed: dict[str, int]
    swept: dict[str, int]
    truncated: list[str]
    total_processed: int
    total_swept: int

    @classmethod
    def of(cls, report: DrainReport) -> DrainResponse:
        return cls(
            processed=report.processed,
            swept=report.swept,
            truncated=report.truncated,
            total_processed=report.total_processed,
            total_swept=report.total_swept,
        )


def _worker_of(request: Request) -> Worker:
    return request.app.state.worker  # pyright: ignore[reportAny]


def _settings_of(request: Request) -> Settings:
    return request.app.state.settings  # pyright: ignore[reportAny]


def _scheduler_tokens(request: Request) -> SchedulerTokens | None:
    return request.app.state.scheduler_tokens  # pyright: ignore[reportAny]


async def require_caller(
    request: Request,
    secret: Annotated[str | None, Header(alias=SECRET_HEADER)] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Admit either caller the worker has, and nothing else.

    The schedule presents a signed Google token; the database webhook presents the shared
    secret, because Postgres cannot mint a token. Both are checked here rather than by Cloud
    Run's IAM, because the service has to stay publicly invocable for the webhook to reach it.

    Failing closed matters more than usual: an unauthenticated drain endpoint is a free way to
    make someone else's OpenAI calls.
    """
    settings = _settings_of(request)
    expected = settings.worker_shared_secret
    tokens = _scheduler_tokens(request)

    if expected is None and tokens is None:
        logger.error("worker.no_caller_configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Neither SYNC_WORKER_SHARED_SECRET nor the scheduler token is configured.",
        )

    if tokens is not None and authorization is not None:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            try:
                caller = tokens.verify(token)
            except OidcRejectedError as rejected:
                logger.warning("worker.token_rejected", reason=str(rejected))
            else:
                logger.info("worker.caller_recognised", caller=caller)
                return

    # Compared in constant time, and only after the token path has had its turn, so a caller
    # holding a good token never depends on the secret being set at all.
    if (
        expected is not None
        and secret is not None
        and secrets.compare_digest(secret, expected.get_secret_value())
    ):
        return

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not a known caller")


def create_app(settings: Settings | None = None, worker: Worker | None = None) -> FastAPI:
    resolved = settings or get_settings()
    configure_logging(level=resolved.log_level, log_format=resolved.log_format)

    # Both halves or neither. An audience with no expected caller would admit any Google token
    # minted for this URL, which is a wider door than the secret it replaces.
    tokens = (
        SchedulerTokens(
            audience=resolved.worker_scheduler_audience,
            service_account=resolved.worker_scheduler_service_account,
        )
        if resolved.worker_scheduler_audience and resolved.worker_scheduler_service_account
        else None
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        app.state.settings = resolved
        app.state.scheduler_tokens = tokens
        # Built once per instance rather than per request: the engines hold the database pool
        # and the model clients, and a cold start pays for them already.
        app.state.worker = worker or Worker(resolved)
        logger.info("worker.service_started", environment=resolved.environment.value)
        try:
            yield
        finally:
            if worker is None:
                await app.state.worker.aclose()
            logger.info("worker.service_stopped")

    app = FastAPI(title="Sync Hub worker", lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/drain", dependencies=[Depends(require_caller)])
    async def drain(request: Request) -> DrainResponse:
        report = await _worker_of(request).drain()
        logger.info("worker.drained", processed=report.processed, truncated=report.truncated)
        return DrainResponse.of(report)

    @app.post("/scheduled", dependencies=[Depends(require_caller)])
    async def scheduled(request: Request) -> DrainResponse:
        report = await _worker_of(request).scheduled()
        logger.info(
            "worker.scheduled",
            processed=report.processed,
            swept=report.swept,
            truncated=report.truncated,
        )
        return DrainResponse.of(report)

    return app
