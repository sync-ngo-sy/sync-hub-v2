from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Final

from sqlalchemy import func, select, update

from sync_core import get_logger, transaction
from sync_core.models import CandidateEmbeddingJob
from sync_worker.engine import SWEEP_BATCH, failure_reason

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy import Update
    from structlog.stdlib import BoundLogger

    from sync_core import Database
    from sync_rag import EmbeddedChunk, ProfileEmbedding

logger = get_logger(__name__)

QUEUE_NAME: Final = "embedding"

MAX_RETRY_DOUBLINGS: Final = 6


@dataclass(frozen=True, slots=True)
class ReembedPolicy:
    backoff_seconds: float
    stuck_after_seconds: float

    def available_after(self, attempts: int) -> datetime:
        doublings = min(max(attempts - 1, 0), MAX_RETRY_DOUBLINGS)
        return datetime.now(UTC) + timedelta(seconds=self.backoff_seconds * 2**doublings)

    @property
    def stuck_before(self) -> datetime:
        return datetime.now(UTC) - timedelta(seconds=self.stuck_after_seconds)


@dataclass(frozen=True, slots=True)
class ClaimedReembed:
    candidate_id: UUID
    revision: int
    attempts: int


class ReembedEngine:
    """`candidate_embedding_jobs` has no `available_at`, so `updated_at` is the earliest time
    to try again: the enqueue trigger sets it to `now()`, a failure pushes it forward."""

    def __init__(
        self, database: Database, embedding: ProfileEmbedding, policy: ReembedPolicy
    ) -> None:
        self._database = database
        self._embedding = embedding
        self._policy = policy

    @property
    def name(self) -> str:
        return QUEUE_NAME

    async def run_once(self) -> bool:
        job = await self._claim()
        if job is None:
            return False

        log = logger.bind(
            queue=QUEUE_NAME, candidate_id=str(job.candidate_id), attempt=job.attempts
        )
        try:
            chunks = await self._embedding.rebuild(job.candidate_id)
        except Exception as error:
            await self._release(job, error, log)
        else:
            await self._store(job, chunks)
            log.info("worker.job_completed", chunks=len(chunks))
        return True

    async def sweep(self) -> int:
        swept = 0
        async with self._database.session() as session, transaction(session):
            stuck = await session.scalars(
                select(CandidateEmbeddingJob)
                .where(CandidateEmbeddingJob.claimed_at < self._policy.stuck_before)
                .order_by(CandidateEmbeddingJob.claimed_at)
                .limit(SWEEP_BATCH)
                .with_for_update(skip_locked=True)
            )
            for row in stuck:
                reason = f"the worker holding this job stopped responding (attempt {row.attempts})"
                await session.execute(self._requeue(row.candidate_id, row.attempts, reason))
                swept += 1

        if swept:
            logger.warning("worker.jobs_swept", queue=QUEUE_NAME, count=swept)
        return swept

    async def _claim(self) -> ClaimedReembed | None:
        oldest_due = (
            select(CandidateEmbeddingJob.candidate_id)
            .where(
                CandidateEmbeddingJob.dirty,
                CandidateEmbeddingJob.claimed_at.is_(None),
                CandidateEmbeddingJob.updated_at <= func.now(),
            )
            .order_by(CandidateEmbeddingJob.updated_at)
            .limit(1)
            .with_for_update(skip_locked=True)
            .scalar_subquery()
        )
        async with self._database.session() as session, transaction(session):
            claimed = await session.execute(
                update(CandidateEmbeddingJob)
                .where(CandidateEmbeddingJob.candidate_id == oldest_due)
                .values(
                    claimed_at=func.now(),
                    attempts=CandidateEmbeddingJob.attempts + 1,
                    error_message=None,
                )
                .returning(
                    CandidateEmbeddingJob.candidate_id,
                    CandidateEmbeddingJob.revision,
                    CandidateEmbeddingJob.attempts,
                )
            )
            row = claimed.one_or_none()

        if row is None:
            return None
        return ClaimedReembed(
            candidate_id=row.candidate_id, revision=row.revision, attempts=row.attempts
        )

    async def _store(self, job: ClaimedReembed, chunks: list[EmbeddedChunk]) -> None:
        async with self._database.session() as session, transaction(session):
            await self._embedding.swap(session, job.candidate_id, chunks)
            await session.execute(
                update(CandidateEmbeddingJob)
                .where(CandidateEmbeddingJob.candidate_id == job.candidate_id)
                .values(
                    dirty=CandidateEmbeddingJob.revision != job.revision,
                    claimed_at=None,
                    attempts=0,
                    error_message=None,
                    updated_at=func.now(),
                )
            )

    async def _release(self, job: ClaimedReembed, error: Exception, log: BoundLogger) -> None:
        reason = failure_reason(error)
        async with self._database.session() as session, transaction(session):
            await session.execute(self._requeue(job.candidate_id, job.attempts, reason))
        log.warning("worker.job_failed", error=reason, exc_info=error)

    def _requeue(self, candidate_id: UUID, attempts: int, reason: str) -> Update:
        return (
            update(CandidateEmbeddingJob)
            .where(CandidateEmbeddingJob.candidate_id == candidate_id)
            .values(
                claimed_at=None,
                error_message=reason,
                updated_at=self._policy.available_after(attempts),
            )
        )
