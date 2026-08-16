from __future__ import annotations

from typing import TYPE_CHECKING, Final, cast

from sync_assessments import ApplicationGoneError
from sync_core import get_logger
from sync_core.models import AssessmentStatus, MatchAssessmentJob
from sync_worker.engine import PermanentFailureError, Queue

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy import Table
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_assessments import AssessedMatch, MatchAssessing
    from sync_worker.engine import ClaimedJob

logger = get_logger(__name__)

MATCH_ASSESSMENT_QUEUE: Final = Queue(
    name="assessment",
    table=cast("Table", MatchAssessmentJob.__table__),
    pending=AssessmentStatus.PENDING,
    processing=AssessmentStatus.PROCESSING,
    completed=AssessmentStatus.COMPLETED,
    failed=AssessmentStatus.FAILED,
)


class MatchAssessmentConsumer:
    """Reads every Application that arrives, so no Recruiter has to ask for the first reading.

    A provider that is unreachable is left to the retry policy — the reading is worth waiting
    for, and the row keeps its place in the queue. An Application that is no longer there is
    not: there is nothing to read, and no number of attempts will make one appear.

    Giving up writes no reading at all. An Application with no Match score is one nobody has
    read, which is what a list showing no score is honestly saying — and a Recruiter can still
    ask for one by hand.
    """

    def __init__(self, assessing: MatchAssessing) -> None:
        self._assessing = assessing

    @property
    def queue(self) -> Queue:
        return MATCH_ASSESSMENT_QUEUE

    async def perform(self, job: ClaimedJob) -> AssessedMatch:
        try:
            return await self._assessing.assess(_application_id(job))
        except ApplicationGoneError as settled:
            raise PermanentFailureError(str(settled)) from settled

    async def record(self, session: AsyncSession, job: ClaimedJob, result: AssessedMatch) -> None:
        await self._assessing.store(session, _application_id(job), result)

    async def give_up(self, session: AsyncSession, job: ClaimedJob, reason: str) -> None:
        logger.warning(
            "assessments.unread", application_id=str(_application_id(job)), reason=reason
        )


def _application_id(job: ClaimedJob) -> UUID:
    application_id: UUID = job.row["application_id"]
    return application_id
