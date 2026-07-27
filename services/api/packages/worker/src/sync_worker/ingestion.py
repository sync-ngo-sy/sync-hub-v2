"""Binding the `ingestion_jobs` queue to the CV pipeline.

Thin on purpose. `sync_ingestion` knows how to read a CV and knows nothing about queues;
`sync_worker.engine` knows how to drain a queue and nothing about CVs. This is the only
file that knows both, and all it decides is which of the pipeline's failures is worth
another attempt.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, cast

from sync_core.models import IngestionJob, IngestionStatus
from sync_ingestion import CvUnparseableError
from sync_worker.engine import PermanentFailureError, Queue

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy import Table
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_ingestion import CvIngestion
    from sync_parsers import ParsedCv
    from sync_worker.engine import ClaimedJob

#: `ingestion_jobs` as the engine sees it. `IngestionJob.__table__` rather than the mapped
#: class: the engine works in columns, and these five are the only ones it touches. The
#: cast is because `DeclarativeBase` types `__table__` as the more general `FromClause`; a
#: mapped class's is always a `Table`.
INGESTION_QUEUE: Final = Queue(
    name="ingestion",
    table=cast("Table", IngestionJob.__table__),
    pending=IngestionStatus.PENDING,
    processing=IngestionStatus.PROCESSING,
    completed=IngestionStatus.COMPLETED,
    failed=IngestionStatus.FAILED,
)


class CvIngestionConsumer:
    """Parses the CV each claimed `ingestion_jobs` row points at."""

    def __init__(self, ingestion: CvIngestion) -> None:
        self._ingestion = ingestion

    @property
    def queue(self) -> Queue:
        return INGESTION_QUEUE

    async def perform(self, job: ClaimedJob) -> ParsedCv:
        """Mark the CV `processing`, then read it.

        `CvUnparseableError` becomes `PermanentFailureError` — a CV file the model cannot
        read, or a file that is no longer in Storage, gets the same answer next time, and
        each attempt at one costs a model call. Everything else falls through and is
        retried on the queue's backoff.
        """
        cv_id = _cv_id(job)
        await self._ingestion.begin(cv_id)
        try:
            return await self._ingestion.parse(cv_id)
        except CvUnparseableError as settled:
            raise PermanentFailureError(str(settled)) from settled

    async def record(self, session: AsyncSession, job: ClaimedJob, result: ParsedCv) -> None:
        await self._ingestion.store(session, _cv_id(job), result)

    async def give_up(self, session: AsyncSession, job: ClaimedJob, reason: str) -> None:
        """The CV is `failed` — the state the candidate's progress indicator ends on.

        Committed with the job's own dead state by the engine, so the two can never
        disagree about whether this CV is still coming.
        """
        await self._ingestion.fail(session, _cv_id(job), reason)


def _cv_id(job: ClaimedJob) -> UUID:
    """The CV a job is about.

    `ingestion_jobs.cv_id` is `NOT NULL` with a `UNIQUE` constraint and a foreign key, so
    reading it out of the claimed row needs no guard — there is exactly one job per CV and
    it cannot exist without one.
    """
    cv_id: UUID = job.row["cv_id"]
    return cv_id
