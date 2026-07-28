from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.problems import MESSAGE_TEMPLATE_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core.models import MessageTemplate

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession


async def own_message_template(
    session: AsyncSession, tenant_id: UUID, template_id: UUID
) -> MessageTemplate:
    """The tenant's own. Another tenant's template and a nonexistent one are the same 404."""
    template = await session.scalar(
        select(MessageTemplate).where(
            MessageTemplate.id == template_id, MessageTemplate.tenant_id == tenant_id
        )
    )
    if template is None:
        raise Problem(
            status=404,
            type=MESSAGE_TEMPLATE_NOT_FOUND_PROBLEM_TYPE,
            detail="No message template of this tenant has that id.",
        )
    return template
