from __future__ import annotations

import asyncio
import signal
from contextlib import suppress
from typing import TYPE_CHECKING, Any

from sync_comms import CommunicationDelivery
from sync_comms.resend_sender import ResendEmailSender
from sync_core import Database, Storage, configure_logging, get_logger
from sync_ingestion import CvIngestion
from sync_parsers.openai_extractor import OpenAiCvExtractor
from sync_rag import ProfileEmbedding
from sync_rag.openai_embedder import OpenAiEmbedder
from sync_worker.communications import CommunicationsConsumer
from sync_worker.embedding import ReembedEngine, ReembedPolicy
from sync_worker.engine import QueueEngine, RetryPolicy
from sync_worker.ingestion import CvIngestionConsumer
from sync_worker.runner import Drainable, consume, sweep

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sync_comms import EmailSender
    from sync_core import Settings
    from sync_parsers import CvExtractor
    from sync_rag import Embedder

logger = get_logger(__name__)


class MissingApiKeyError(RuntimeError):
    pass


class Worker:
    def __init__(
        self,
        settings: Settings,
        extractor: CvExtractor | None = None,
        embedder: Embedder | None = None,
        sender: EmailSender | None = None,
    ) -> None:
        self._settings = settings
        self._database = Database(settings)
        self._storage = Storage.build(settings)
        self._extractor = extractor or _openai_extractor(settings)
        self._embedder = embedder or _openai_embedder(settings)
        self._sender = sender or _resend_sender(settings)
        self._policy = RetryPolicy(
            max_attempts=settings.worker_max_attempts,
            backoff_seconds=settings.worker_retry_backoff_seconds,
            stuck_after_seconds=settings.worker_stuck_job_seconds,
        )

    @property
    def _engines(self) -> Sequence[tuple[Drainable, int]]:
        ingestion: QueueEngine[Any] = QueueEngine(
            self._database,
            CvIngestionConsumer(CvIngestion(self._database, self._storage, self._extractor)),
            self._policy,
        )
        embedding = ReembedEngine(
            self._database,
            ProfileEmbedding(self._database, self._embedder),
            ReembedPolicy(
                backoff_seconds=self._settings.worker_retry_backoff_seconds,
                stuck_after_seconds=self._settings.worker_stuck_job_seconds,
            ),
        )
        communications: QueueEngine[Any] = QueueEngine(
            self._database,
            CommunicationsConsumer(CommunicationDelivery(self._database, self._sender)),
            self._policy,
        )
        return [
            (ingestion, self._settings.worker_ingestion_concurrency),
            (embedding, self._settings.worker_embedding_concurrency),
            (communications, self._settings.worker_communications_concurrency),
        ]

    async def run(self) -> None:
        engines = self._engines
        logger.info(
            "worker.started",
            environment=self._settings.environment.value,
            queues=[engine.name for engine, _ in engines],
        )
        try:
            async with asyncio.TaskGroup() as group:
                for engine, concurrency in engines:
                    for _ in range(concurrency):
                        group.create_task(
                            consume(
                                engine,
                                interval=self._settings.worker_poll_interval_seconds,
                                idle_max=self._settings.worker_idle_backoff_max_seconds,
                            )
                        )
                    group.create_task(
                        sweep(engine, every=self._settings.worker_sweep_interval_seconds)
                    )
        finally:
            await self.aclose()
            logger.info("worker.stopped")

    async def aclose(self) -> None:
        await self._storage.aclose()
        await self._database.dispose()


def _openai_extractor(settings: Settings) -> CvExtractor:
    if settings.openai_api_key is None:
        raise MissingApiKeyError(
            "SYNC_OPENAI_API_KEY is not set — the worker cannot parse CVs without it."
        )
    return OpenAiCvExtractor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_cv_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


def _openai_embedder(settings: Settings) -> Embedder:
    if settings.openai_api_key is None:
        raise MissingApiKeyError(
            "SYNC_OPENAI_API_KEY is not set — the worker cannot embed profiles without it."
        )
    return OpenAiEmbedder.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_embedding_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


def _resend_sender(settings: Settings) -> EmailSender:
    if settings.resend_api_key is None:
        raise MissingApiKeyError(
            "SYNC_RESEND_API_KEY is not set — the worker cannot send Communications without it."
        )
    return ResendEmailSender.build(
        api_key=settings.resend_api_key.get_secret_value(),
        sender=settings.email_from,
        timeout_seconds=settings.email_timeout_seconds,
    )


async def run_worker(settings: Settings) -> None:
    configure_logging(level=settings.log_level, log_format=settings.log_format)
    running = asyncio.ensure_future(Worker(settings).run())
    loop = asyncio.get_running_loop()
    for signalled in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(signalled, running.cancel)
    with suppress(asyncio.CancelledError):
        await running
