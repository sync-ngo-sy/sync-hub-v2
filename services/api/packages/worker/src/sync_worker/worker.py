"""The worker process: what it owns, what it runs, and how it stops.

One process for every queue the platform has (ADR-0003's amendment), because at this size
three processes would be three deployments and three sets of connections to watch for no
benefit — the consumers are independent asyncio tasks, and a per-queue concurrency cap is
what keeps a burst of CVs from starving the others.

Only CV ingestion exists yet. The embedding and communications consumers come with their
own tickets, and adding one is adding a `QueueEngine` to `_engines` — the loops, the
backoff, the sweep and the shutdown are already here.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

from sync_core import Database, Storage, configure_logging, get_logger
from sync_ingestion import CvIngestion
from sync_parsers.openai_extractor import OpenAiCvExtractor
from sync_worker.engine import QueueEngine, RetryPolicy
from sync_worker.ingestion import CvIngestionConsumer
from sync_worker.runner import consume, sweep

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sync_core import Settings
    from sync_parsers import CvExtractor

logger = get_logger(__name__)


class MissingApiKeyError(RuntimeError):
    """The worker was started without the key it needs to read a single CV."""


class Worker:
    """Every queue consumer this process runs, and the resources they share."""

    def __init__(self, settings: Settings, extractor: CvExtractor | None = None) -> None:
        self._settings = settings
        self._database = Database(settings)
        self._storage = Storage.build(settings)
        self._extractor = extractor or _openai_extractor(settings)
        self._policy = RetryPolicy(
            max_attempts=settings.worker_max_attempts,
            backoff_seconds=settings.worker_retry_backoff_seconds,
            stuck_after_seconds=settings.worker_stuck_job_seconds,
        )

    @property
    def _engines(self) -> Sequence[tuple[QueueEngine[Any], int]]:
        """Each queue's engine, with how many of its jobs may be in flight at once.

        `QueueEngine[Any]` because the list is heterogeneous: each consumer produces its own
        result type, and nothing here ever touches one — the loops only claim, run and
        sweep, none of which mention it.
        """
        ingestion = QueueEngine(
            self._database,
            CvIngestionConsumer(CvIngestion(self._database, self._storage, self._extractor)),
            self._policy,
        )
        return [(ingestion, self._settings.worker_ingestion_concurrency)]

    async def run(self) -> None:
        """Drain every queue until the process is asked to stop.

        Cancelling the group is the shutdown: each loop is sitting in a poll sleep or in
        the middle of a job, and a cancelled job simply stays `processing` until the sweep
        requeues it — which is the same thing that happens when a worker is killed, so
        there is only one recovery path to have got right.
        """
        engines = self._engines
        logger.info(
            "worker.started",
            environment=self._settings.environment.value,
            queues=[engine.queue.name for engine, _ in engines],
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
    """The real adapter, refused loudly rather than lazily when there is no key.

    At startup, because a worker that starts happily and then fails every CV it claims
    would burn all three attempts on each one before anybody noticed the deployment was
    missing a variable.
    """
    if settings.openai_api_key is None:
        raise MissingApiKeyError(
            "SYNC_OPENAI_API_KEY is not set — the worker cannot parse CVs without it."
        )
    return OpenAiCvExtractor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_cv_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


async def run_worker(settings: Settings) -> None:
    configure_logging(level=settings.log_level, log_format=settings.log_format)
    await Worker(settings).run()
