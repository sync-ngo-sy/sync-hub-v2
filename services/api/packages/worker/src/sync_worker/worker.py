from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sync_assessments import MatchAssessing
from sync_assessments.openai_assessor import OpenAiMatchAssessor
from sync_comms import CommunicationDelivery
from sync_comms.resend_sender import ResendEmailSender
from sync_core import Database, Storage, configure_logging, get_logger, get_settings
from sync_ingestion import CvIngestion
from sync_parsers.openai_extractor import OpenAiCvExtractor
from sync_rag import ProfileEmbedding
from sync_rag.openai_embedder import OpenAiEmbedder
from sync_worker.assessment import MatchAssessmentConsumer
from sync_worker.communications import CommunicationsConsumer
from sync_worker.embedding import ReembedEngine, ReembedPolicy
from sync_worker.engine import QueueEngine, RetryPolicy
from sync_worker.ingestion import CvIngestionConsumer
from sync_worker.runner import Drainable, DrainReport, drain_queue

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sync_assessments import MatchAssessor
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
        assessor: MatchAssessor | None = None,
    ) -> None:
        self._settings = settings
        self._database = Database(settings)
        self._storage = Storage.build(settings)
        self._extractor = extractor or _openai_extractor(settings)
        self._embedder = embedder or _openai_embedder(settings)
        self._sender = sender or _resend_sender(settings)
        self._assessor = assessor or _openai_assessor(settings)
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
        assessment: QueueEngine[Any] = QueueEngine(
            self._database,
            MatchAssessmentConsumer(MatchAssessing(self._database, self._assessor)),
            self._policy,
        )
        return [
            (ingestion, self._settings.worker_ingestion_concurrency),
            (embedding, self._settings.worker_embedding_concurrency),
            (communications, self._settings.worker_communications_concurrency),
            (assessment, self._settings.worker_assessment_concurrency),
        ]

    async def drain(self) -> DrainReport:
        """Empty every queue, then return. Safe to call concurrently with itself.

        Parallel invocations cannot double-process: claims take a row lock with skip-locked,
        so a second caller simply sees fewer rows. A burst of notifications therefore
        coalesces — whichever instance arrives first drains the backlog the others would
        have.
        """
        processed: dict[str, int] = {}
        truncated: list[str] = []
        for engine, concurrency in self._engines:
            count, hit_bound = await drain_queue(
                engine,
                concurrency=concurrency,
                max_rows=self._settings.worker_drain_max_rows,
            )
            processed[engine.name] = count
            if hit_bound:
                truncated.append(engine.name)
        return DrainReport(processed=processed, truncated=truncated)

    async def sweep(self) -> dict[str, int]:
        """Return rows a crashed invocation abandoned mid-processing to pending."""
        swept: dict[str, int] = {}
        for engine, _ in self._engines:
            try:
                swept[engine.name] = await engine.sweep()
            except Exception:
                logger.exception("worker.sweep_failed", queue=engine.name)
                swept[engine.name] = 0
        return swept

    async def scheduled(self) -> DrainReport:
        """The correctness guarantee: sweep, then drain.

        A dropped webhook leaves a row pending, and a sweep would never see it — sweeping
        only rescues rows already in processing. The drain half is what picks those up, which
        is what makes the schedule sufficient on its own and the webhook merely a latency
        optimisation.

        A row the sweep releases returns to pending carrying its retry delay, so the call that
        finishes it may be this one or a later one. Either way it is no longer stranded in
        processing with nobody looking at it.
        """
        swept = await self.sweep()
        drained = await self.drain()
        return DrainReport(processed=drained.processed, swept=swept, truncated=drained.truncated)

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


def _openai_assessor(settings: Settings) -> MatchAssessor:
    if settings.openai_api_key is None:
        raise MissingApiKeyError(
            "SYNC_OPENAI_API_KEY is not set — the worker cannot assess Applications without it."
        )
    return OpenAiMatchAssessor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_assessment_model,
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


async def drain_once(settings: Settings | None = None, worker: Worker | None = None) -> DrainReport:
    """Sweep and drain once, then close everything down.

    The same operation the scheduled endpoint performs, without a server in front of it. Local
    development needs this — nothing calls the endpoints on a developer's machine — and it is
    also what you run to clear a backlog by hand rather than waiting for the next schedule.
    """
    running = worker
    if running is None:
        # Only read here: a caller supplying its own Worker has already decided both, and
        # reaching for the environment would make this unusable without a full .env.
        resolved = settings or get_settings()
        configure_logging(level=resolved.log_level, log_format=resolved.log_format)
        running = Worker(resolved)
    try:
        return await running.scheduled()
    finally:
        if worker is None:
            await running.aclose()
