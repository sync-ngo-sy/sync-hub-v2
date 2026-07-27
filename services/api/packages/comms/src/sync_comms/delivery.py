from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from pydantic import ValidationError
from sqlalchemy import func, select, update

from sync_comms.email import EmailMessage, UnsendableEmailError
from sync_comms.templates import render
from sync_core import get_logger
from sync_core.communications import payload_of
from sync_core.models import Communication, CommunicationChannel, User

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_comms.email import EmailSender
    from sync_core import Database
    from sync_core.communications import CommunicationPayload

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class QueuedCommunication:
    id: UUID
    candidate_id: UUID
    channel: CommunicationChannel
    template_key: str | None
    payload: dict[str, Any]
    idempotency_key: str


@dataclass(frozen=True, slots=True)
class Delivered:
    recipient: str
    subject: str
    provider: str
    message_id: str


class CommunicationDelivery:
    """A queued Communication, rendered and handed to the provider."""

    def __init__(self, database: Database, sender: EmailSender) -> None:
        self._database = database
        self._sender = sender

    async def send(self, message: QueuedCommunication) -> Delivered:
        if message.channel is not CommunicationChannel.EMAIL:
            raise UnsendableEmailError(f"the sender delivers email, not {message.channel.value}")

        recipient = await self._verified_email(message.candidate_id)
        rendered = render(message.template_key, _payload_of(message))
        sent = await self._sender.send(
            EmailMessage(
                to=recipient,
                subject=rendered.subject,
                html=rendered.html,
                text=rendered.text,
                # The provider's own guard against the double-send a re-claimed row would
                # otherwise cause: same key, same message, one delivery.
                idempotency_key=message.idempotency_key,
            )
        )
        return Delivered(
            recipient=recipient,
            subject=rendered.subject,
            provider=sent.provider,
            message_id=sent.message_id,
        )

    async def record(
        self, session: AsyncSession, communication_id: UUID, delivered: Delivered
    ) -> None:
        await session.execute(
            update(Communication)
            .where(Communication.id == communication_id)
            .values(
                recipient=delivered.recipient,
                subject=delivered.subject,
                provider=delivered.provider,
                provider_message_id=delivered.message_id,
                sent_at=func.now(),
            )
        )
        logger.info(
            "communications.sent",
            communication_id=str(communication_id),
            provider=delivered.provider,
            provider_message_id=delivered.message_id,
        )

    async def _verified_email(self, candidate_id: UUID) -> str:
        """Where the message goes, straight from the identity that owns the account.

        Never the Snapshot's address and never the queued one: both are what a Candidate
        typed at some past moment, and only auth has confirmed anything.
        """
        async with self._database.session() as session:
            email = await session.scalar(
                select(User.email).where(
                    User.id == candidate_id, User.email_confirmed_at.is_not(None)
                )
            )
        if not email:
            raise UnsendableEmailError(f"candidate {candidate_id} has no confirmed email address")
        return email


def _payload_of(message: QueuedCommunication) -> CommunicationPayload:
    try:
        return payload_of(message.payload)
    except ValidationError as malformed:
        raise UnsendableEmailError(
            f"communication {message.id} carries a payload no template can read"
        ) from malformed
