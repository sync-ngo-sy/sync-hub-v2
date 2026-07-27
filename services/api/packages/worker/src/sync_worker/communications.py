from __future__ import annotations

from typing import TYPE_CHECKING, Final, cast

from sync_comms import CommunicationDelivery, QueuedCommunication, UnsendableEmailError
from sync_core import get_logger
from sync_core.models import Communication, CommunicationChannel, CommunicationStatus
from sync_worker.engine import PermanentFailureError, Queue

if TYPE_CHECKING:
    from sqlalchemy import Table
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_comms import Delivered
    from sync_worker.engine import ClaimedJob

logger = get_logger(__name__)

COMMUNICATIONS_QUEUE: Final = Queue(
    name="communications",
    table=cast("Table", Communication.__table__),
    pending=CommunicationStatus.QUEUED,
    processing=CommunicationStatus.PROCESSING,
    completed=CommunicationStatus.SENT,
    failed=CommunicationStatus.FAILED,
    mine=(Communication.channel == CommunicationChannel.EMAIL,),
)


class CommunicationsConsumer:
    """The Communication row is both the job and its own audit trail."""

    def __init__(self, delivery: CommunicationDelivery) -> None:
        self._delivery = delivery

    @property
    def queue(self) -> Queue:
        return COMMUNICATIONS_QUEUE

    async def perform(self, job: ClaimedJob) -> Delivered:
        try:
            return await self._delivery.send(_queued(job))
        except UnsendableEmailError as settled:
            raise PermanentFailureError(str(settled)) from settled

    async def record(self, session: AsyncSession, job: ClaimedJob, result: Delivered) -> None:
        await self._delivery.record(session, job.id, result)

    async def give_up(self, session: AsyncSession, job: ClaimedJob, reason: str) -> None:
        logger.warning("communications.undelivered", communication_id=str(job.id), reason=reason)


def _queued(job: ClaimedJob) -> QueuedCommunication:
    row = job.row
    return QueuedCommunication(
        id=job.id,
        candidate_id=row["candidate_id"],
        channel=row["channel"],
        template_key=row["template_key"],
        payload=row["payload"],
        idempotency_key=row["idempotency_key"],
    )
