from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any, Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from sync_core.models import Communication, CommunicationChannel, CommunicationType

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class ApplicationConfirmation(BaseModel):
    """The receipt for a submitted Application. Names and ids; the sender writes the prose."""

    model_config = ConfigDict(frozen=True)

    type: Literal[CommunicationType.APPLICATION_CONFIRMATION] = (
        CommunicationType.APPLICATION_CONFIRMATION
    )
    application_id: UUID
    job_title: str
    tenant_name: str
    candidate_name: str


CommunicationPayload = Annotated[ApplicationConfirmation, Field(discriminator="type")]

_STORED_PAYLOAD: Final[TypeAdapter[ApplicationConfirmation]] = TypeAdapter(CommunicationPayload)


def payload_of(stored: dict[str, Any]) -> ApplicationConfirmation:
    return _STORED_PAYLOAD.validate_python(stored)


async def enqueue_email(
    session: AsyncSession,
    *,
    candidate_id: UUID,
    recipient: str,
    payload: CommunicationPayload,
    idempotency_key: str,
    tenant_id: UUID | None = None,
    application_id: UUID | None = None,
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
        channel=CommunicationChannel.EMAIL,
        communication_type=payload.type,
        recipient=recipient,
        payload=payload.model_dump(mode="json"),
        idempotency_key=idempotency_key,
    )
    session.add(communication)
    await session.flush()
    return communication
