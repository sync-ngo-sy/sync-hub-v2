from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

from sync_api.applications.access import own_application
from sync_api.messaging.access import own_message_template
from sync_api.messaging.payload import QueuedMessage
from sync_api.messaging.placeholders import Placeholders
from sync_core import get_logger, transaction
from sync_core.communications import RecruiterMessage, candidate_contact, enqueue_email

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.messaging.payload import OutgoingMessage
    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)


class OutreachService:
    """A Recruiter writing one applicant from one of the Tenant's Message templates.

    Placeholders resolve here, once, and the resolved words are what the Communication carries —
    so what a Candidate was sent outlives the template being rewritten. A send may bring its own
    words instead of the template's; they are read the same way and the template stays as saved.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def send(
        self, recruiter: ActingRecruiter, application_id: UUID, outgoing: OutgoingMessage
    ) -> QueuedMessage:
        applied = await own_application(self._db, recruiter.tenant.id, application_id)
        template = await own_message_template(self._db, recruiter.tenant.id, outgoing.template_id)
        application = applied.application
        full_name, email = await candidate_contact(self._db, application.candidate_id)

        resolved = Placeholders(
            candidate_name=full_name,
            job_title=applied.job.title,
            tenant_name=applied.tenant_name,
        )
        words = outgoing.edited or template
        payload = RecruiterMessage(
            application_id=application.id,
            tenant_name=applied.tenant_name,
            template_name=template.name,
            subject=resolved.fill(words.subject),
            body=resolved.fill(words.body),
        )
        async with transaction(self._db):
            communication = await enqueue_email(
                self._db,
                candidate_id=application.candidate_id,
                tenant_id=recruiter.tenant.id,
                application_id=application.id,
                initiated_by_recruiter_id=recruiter.profile.id,
                recipient=email,
                # Nothing to derive a key from: the same template sent twice is meant twice.
                idempotency_key=f"recruiter-message:{uuid4()}",
                payload=payload,
            )

        logger.info(
            "messaging.message_queued",
            communication_id=str(communication.id),
            application_id=str(application.id),
            template_id=str(template.id),
            tenant_id=str(recruiter.tenant.id),
            edited=outgoing.edited is not None,
        )
        return QueuedMessage(
            id=communication.id,
            subject=payload.subject,
            body=payload.body,
            status=communication.status,
            created_at=communication.created_at,
        )
