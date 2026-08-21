from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Annotated, Any, ClassVar, Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from sqlalchemy import select

from sync_core.models import (
    Communication,
    CommunicationChannel,
    CommunicationType,
    Profile,
    User,
)

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


class RecruiterMessage(BaseModel):
    """What a Recruiter wrote one applicant, from a Message template with its placeholders
    already resolved. Unlike the other two, the prose is the tenant's rather than the sender's,
    so it is carried here — the template it came from can be rewritten or deleted afterwards
    without touching what the Candidate was actually sent."""

    model_config = ConfigDict(frozen=True)

    template_key: ClassVar[str] = "recruiter-message.v1"

    type: Literal[CommunicationType.RECRUITER_MESSAGE] = CommunicationType.RECRUITER_MESSAGE
    application_id: UUID
    tenant_name: str
    template_name: str
    subject: str
    body: str


AnyCommunication = ApplicationConfirmation | ApplicationRejection | RecruiterMessage

CommunicationPayload = Annotated[AnyCommunication, Field(discriminator="type")]

_STORED_PAYLOAD: Final[TypeAdapter[AnyCommunication]] = TypeAdapter(CommunicationPayload)


def payload_of(stored: dict[str, Any]) -> AnyCommunication:
    return _STORED_PAYLOAD.validate_python(stored)


async def candidate_contact(session: AsyncSession, candidate_id: UUID) -> tuple[str, str]:
    """The name to greet, and the address as it stands, for a message about to be queued.

    Auditing what the address was is all the second of those is for — the sender resolves the
    verified one again, and refuses a candidate who has none, which is why an address-less
    identity is recorded here rather than refused.
    """
    full_name, email = (
        (
            await session.execute(
                select(Profile.full_name, User.email)
                .join(User, User.id == Profile.id)
                .where(Profile.id == candidate_id)
            )
        )
        .tuples()
        .one()
    )
    return full_name, email or ""


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
    available_at: datetime | None = None,
) -> Communication:
    """Queue one message for the sender to deliver, and audit it.

    Flushed, never committed: the caller's transaction is what keeps the message and the thing
    it announces from ever disagreeing. `recipient` is what the address was at the time; the
    sender resolves the verified one again before it sends. `available_at` is the earliest the
    sender may take it, which a rejection sets to its Telling.
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
        available_at=available_at,
    )
    session.add(communication)
    await session.flush()
    return communication
