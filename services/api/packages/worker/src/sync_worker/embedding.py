from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Final

from sqlalchemy import func, select, update

from sync_core import get_logger, transaction
from sync_core.models import Candidate, CandidateEmbeddingJob
from sync_worker.engine import SWEEP_BATCH, failure_reason

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy import ColumnElement, Update
    from sqlalchemy.ext.asyncio import AsyncSession
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
    #: What makes this claim *this* worker's, and not the one a sweep handed to its successor.
    claimed_at: datetime


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
            await self._store(job, chunks, log)
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
                    CandidateEmbeddingJob.claimed_at,
                )
            )
            row = claimed.one_or_none()

        if row is None:
            return None
        return ClaimedReembed(
            candidate_id=row.candidate_id,
            revision=row.revision,
            attempts=row.attempts,
            claimed_at=row.claimed_at,
        )

    async def _store(
        self, job: ClaimedReembed, chunks: list[EmbeddedChunk], log: BoundLogger
    ) -> None:
        async with self._database.session() as session, transaction(session):
            # The Candidate first and the queue row second, which is the order the account scrub
            # takes them in too — the other way round is a deadlock waiting for a slow embedder.
            gone = await _candidate_is_gone(session, job.candidate_id)
            still_ours = await session.execute(self._settle(job))
            if gone:
                # The scrub deletes this queue row along with the account, so the settle above
                # almost always matched nothing. Settled anyway for the case where it did, so a
                # job whose candidate is gone is finished rather than swept forever.
                log.info("worker.candidate_gone", chunks=len(chunks))
                return
            if still_ours.one_or_none() is None:
                log.warning("worker.claim_lost", chunks=len(chunks))
                return
            await self._embedding.swap(session, job.candidate_id, chunks)
        log.info("worker.job_completed", chunks=len(chunks))

    async def _release(self, job: ClaimedReembed, error: Exception, log: BoundLogger) -> None:
        reason = failure_reason(error)
        async with self._database.session() as session, transaction(session):
            released = await session.execute(
                self._requeue(job.candidate_id, job.attempts, reason).where(*_claim_held(job))
            )
            if released.one_or_none() is None:
                log.warning("worker.claim_lost", error=reason)
                return
        log.warning("worker.job_failed", error=reason, exc_info=error)

    def _settle(self, job: ClaimedReembed) -> Update:
        return (
            update(CandidateEmbeddingJob)
            .where(*_claim_held(job))
            .values(
                dirty=CandidateEmbeddingJob.revision != job.revision,
                claimed_at=None,
                attempts=0,
                error_message=None,
                updated_at=func.now(),
            )
            .returning(CandidateEmbeddingJob.candidate_id)
        )

    def _requeue(self, candidate_id: UUID, attempts: int, reason: str) -> Update:
        """`returning` so a caller can tell a write that landed from one that matched no row.
        The sweep, which holds the row locked while it writes, has no need to look."""
        return (
            update(CandidateEmbeddingJob)
            .where(CandidateEmbeddingJob.candidate_id == candidate_id)
            .values(
                claimed_at=None,
                error_message=reason,
                updated_at=self._policy.available_after(attempts),
            )
            .returning(CandidateEmbeddingJob.candidate_id)
        )


def _claim_held(job: ClaimedReembed) -> tuple[ColumnElement[bool], ...]:
    """The row exactly as the claim left it.

    Every write a worker makes at the end of a job asserts this, because a job that outran the
    stuck threshold has been swept and re-claimed by somebody else. Releasing a claim that is no
    longer yours puts a second worker on the same candidate, and the two then race on the
    chunk table's uniqueness constraint. `attempts` is in here beside `claimed_at` so that a
    sweep and a re-claim inside one clock tick still read as a different claim.
    """
    return (
        CandidateEmbeddingJob.candidate_id == job.candidate_id,
        CandidateEmbeddingJob.claimed_at == job.claimed_at,
        CandidateEmbeddingJob.attempts == job.attempts,
    )


async def _candidate_is_gone(session: AsyncSession, candidate_id: UUID) -> bool:
    """Take the Candidate row and re-read its deleted state inside the writing transaction.

    The same lock the account scrub takes, so a deletion is either wholly before this read or
    wholly after this commit. Without it the chunks come back for a profile that has just been
    erased — and nothing ever clears them: the queue row went with the account, so no rebuild
    is enqueued, and the eligibility projection hides the rows from every reader.
    """
    candidate = await session.get(Candidate, candidate_id, with_for_update=True)
    return candidate is None or candidate.deleted_at is not None
