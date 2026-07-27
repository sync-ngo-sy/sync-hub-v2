from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any, ClassVar, Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from sync_core.models import Communication, CommunicationChannel, CommunicationType

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class ApplicationConfirmation(BaseModel):
    """The receipt for a submitted Application. Names and ids; the sender writes the prose."""

    model_config = ConfigDict(frozen=True)

    #: Which of the sender's templates turns this payload into prose. Versioned, so a row
    #: queued today still says which wording it was queued for.
    template_key: ClassVar[str] = "application-confirmation.v1"

    type: Literal[CommunicationType.APPLICATION_CONFIRMATION] = (
        CommunicationType.APPLICATION_CONFIRMATION
    )
    application_id: UUID
    job_title: str
    tenant_name: str
    candidate_name: str


class ApplicationRejection(BaseModel):
    """The one rejection a Candidate is emailed about: the one a human Recruiter decided."""

    model_config = ConfigDict(frozen=True)

    template_key: ClassVar[str] = "application-rejection.v1"

    type: Literal[CommunicationType.APPLICATION_REJECTION] = CommunicationType.APPLICATION_REJECTION
    application_id: UUID
    job_title: str
    tenant_name: str
    candidate_name: str


CommunicationPayload = Annotated[
    ApplicationConfirmation | ApplicationRejection, Field(discriminator="type")
]

_STORED_PAYLOAD: Final[TypeAdapter[ApplicationConfirmation | ApplicationRejection]] = TypeAdapter(
    CommunicationPayload
)


def payload_of(stored: dict[str, Any]) -> ApplicationConfirmation | ApplicationRejection:
    return _STORED_PAYLOAD.validate_python(stored)


async def enqueue_email(
    session: AsyncSession,
    *,
    candidate_id: UUID,
    recipient: str,
    payload: CommunicationPayload,
    idempotency_key: str,
    tenant_id: UUID | None,
    application_id: UUID | None,
    initiated_by_recruiter_id: UUID | None = None,
) -> Communication:
    """Queue one message for the sender to deliver, and audit it.

    Flushed, never committed: the caller's transaction is what keeps the message and the thing
    it announces from ever disagreeing. `recipient` is what the address was at the time; the
    sender resolves the verified one again before it sends.
    """
    communication = Communication(
        candidate_id=candidate_id,
        tenant_id=tenant_id,
        application_id=application_id,
        initiated_by_recruiter_id=initiated_by_recruiter_id,
        channel=CommunicationChannel.EMAIL,
        communication_type=payload.type,
        recipient=recipient,
        payload=payload.model_dump(mode="json"),
        template_key=payload.template_key,
        idempotency_key=idempotency_key,
    )
    session.add(communication)
    await session.flush()
    return communication
