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

INGESTION_QUEUE: Final = Queue(
    name="ingestion",
    table=cast("Table", IngestionJob.__table__),
    pending=IngestionStatus.PENDING,
    processing=IngestionStatus.PROCESSING,
    completed=IngestionStatus.COMPLETED,
    failed=IngestionStatus.FAILED,
)


class CvIngestionConsumer:
    def __init__(self, ingestion: CvIngestion) -> None:
        self._ingestion = ingestion

    @property
    def queue(self) -> Queue:
        return INGESTION_QUEUE

    async def perform(self, job: ClaimedJob) -> ParsedCv:
        cv_id = _cv_id(job)
        await self._ingestion.begin(cv_id)
        try:
            return await self._ingestion.parse(cv_id)
        except CvUnparseableError as settled:
            raise PermanentFailureError(str(settled)) from settled

    async def record(self, session: AsyncSession, job: ClaimedJob, result: ParsedCv) -> None:
        await self._ingestion.store(session, _cv_id(job), result)

    async def give_up(self, session: AsyncSession, job: ClaimedJob, reason: str) -> None:
        await self._ingestion.fail(session, _cv_id(job), reason)


def _cv_id(job: ClaimedJob) -> UUID:
    cv_id: UUID = job.row["cv_id"]
    return cv_id
