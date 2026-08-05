from __future__ import annotations

from typing import TYPE_CHECKING, Final, NoReturn

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from sync_api.integrity import refuse_duplicate
from sync_api.messaging.access import own_message_template
from sync_api.messaging.payload import MessageTemplate
from sync_api.problems import MESSAGE_TEMPLATE_NAME_TAKEN_PROBLEM_TYPE
from sync_core import get_logger, transaction
from sync_core.models import MessageTemplate as MessageTemplateRow

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.messaging.payload import MessageTemplateChanges, NewMessageTemplate
    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)

NAME_CONSTRAINTS: Final = (
    "message_templates_tenant_id_name_key",
    "message_templates_tenant_name_ci_uidx",
)


class MessageTemplateService:
    """One Tenant's Message templates — the words its recruiters reuse when they write an
    applicant. Any recruiter of the Tenant manages any of them; the one who first wrote a
    template is recorded on it and never changes."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def create(self, recruiter: ActingRecruiter, new: NewMessageTemplate) -> MessageTemplate:
        template = MessageTemplateRow(
            tenant_id=recruiter.tenant.id,
            created_by_recruiter_id=recruiter.profile.id,
            name=new.name,
            subject=new.subject,
            body=new.body,
        )
        try:
            async with transaction(self._db):
                self._db.add(template)
        except IntegrityError as clash:
            _refuse_duplicate_name(clash, new.name)

        logger.info(
            "messaging.template_created",
            template_id=str(template.id),
            tenant_id=str(recruiter.tenant.id),
        )
        return MessageTemplate.of(template)

    async def templates(self, recruiter: ActingRecruiter) -> list[MessageTemplate]:
        rows = await self._db.scalars(
            select(MessageTemplateRow)
            .where(MessageTemplateRow.tenant_id == recruiter.tenant.id)
            .order_by(MessageTemplateRow.name)
        )
        return [MessageTemplate.of(row) for row in rows]

    async def template(self, recruiter: ActingRecruiter, template_id: UUID) -> MessageTemplate:
        return MessageTemplate.of(
            await own_message_template(self._db, recruiter.tenant.id, template_id)
        )

    async def revise(
        self, recruiter: ActingRecruiter, template_id: UUID, changes: MessageTemplateChanges
    ) -> MessageTemplate:
        template = await own_message_template(self._db, recruiter.tenant.id, template_id)
        try:
            async with transaction(self._db):
                template.name = changes.name
                template.subject = changes.subject
                template.body = changes.body
        except IntegrityError as clash:
            _refuse_duplicate_name(clash, changes.name)

        logger.info(
            "messaging.template_revised",
            template_id=str(template_id),
            tenant_id=str(recruiter.tenant.id),
        )
        await self._db.refresh(template)  # `updated_at` is the trigger's to write, not ours
        return MessageTemplate.of(template)

    async def remove(self, recruiter: ActingRecruiter, template_id: UUID) -> None:
        """Nothing already sent from it is touched: the Communication carries its own words."""
        template = await own_message_template(self._db, recruiter.tenant.id, template_id)
        async with transaction(self._db):
            await self._db.delete(template)

        logger.info(
            "messaging.template_deleted",
            template_id=str(template_id),
            tenant_id=str(recruiter.tenant.id),
        )


def _refuse_duplicate_name(clash: IntegrityError, name: str) -> NoReturn:
    """A template is what a recruiter picks by name, so two of one name is a clean 409."""
    refuse_duplicate(
        clash,
        *NAME_CONSTRAINTS,
        problem_type=MESSAGE_TEMPLATE_NAME_TAKEN_PROBLEM_TYPE,
        detail=f"This tenant already has a message template called “{name}”.",
    )
