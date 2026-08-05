from __future__ import annotations

from typing import TYPE_CHECKING, Final, NoReturn

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from sync_api.crm.access import own_tag
from sync_api.crm.payload import Tag
from sync_api.integrity import refuse_duplicate
from sync_api.problems import TAG_NAME_TAKEN_PROBLEM_TYPE
from sync_core import get_logger, transaction
from sync_core.models import TenantTag

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.crm.payload import NewTag, TagChanges
    from sync_api.tenants import ActingRecruiter
    from sync_core.models import TagScope

logger = get_logger(__name__)

#: Two ways one name is unique: exactly, and case-insensitively. Either refusal is the same 409.
NAME_CONSTRAINTS: Final = (
    "tenant_tags_tenant_id_scope_name_key",
    "tenant_tags_tenant_scope_name_ci_uidx",
)


class TagService:
    """One Tenant's Tags — the private vocabulary it files Candidates and Applications under."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def create(self, recruiter: ActingRecruiter, new: NewTag) -> Tag:
        tag = TenantTag(tenant_id=recruiter.tenant.id, name=new.name, scope=new.scope)
        try:
            async with transaction(self._db):
                self._db.add(tag)
        except IntegrityError as clash:
            _refuse_duplicate_name(clash, new.name)

        logger.info("crm.tag_created", tag_id=str(tag.id), tenant_id=str(recruiter.tenant.id))
        return Tag.of(tag)

    async def tags(self, recruiter: ActingRecruiter, *, scope: TagScope | None = None) -> list[Tag]:
        query = select(TenantTag).where(TenantTag.tenant_id == recruiter.tenant.id)
        if scope is not None:
            query = query.where(TenantTag.scope == scope)
        rows = await self._db.scalars(query.order_by(TenantTag.scope, TenantTag.name))
        return [Tag.of(row) for row in rows]

    async def rename(self, recruiter: ActingRecruiter, tag_id: UUID, changes: TagChanges) -> Tag:
        tag = await own_tag(self._db, recruiter.tenant.id, tag_id)
        try:
            async with transaction(self._db):
                tag.name = changes.name
        except IntegrityError as clash:
            _refuse_duplicate_name(clash, changes.name)

        logger.info("crm.tag_renamed", tag_id=str(tag_id), tenant_id=str(recruiter.tenant.id))
        return Tag.of(tag)

    async def remove(self, recruiter: ActingRecruiter, tag_id: UUID) -> None:
        tag = await own_tag(self._db, recruiter.tenant.id, tag_id)
        async with transaction(self._db):
            # Both assignment tables cascade from `tenant_tags`, so unfiling is the delete.
            await self._db.delete(tag)

        logger.info("crm.tag_deleted", tag_id=str(tag_id), tenant_id=str(recruiter.tenant.id))


def _refuse_duplicate_name(clash: IntegrityError, name: str) -> NoReturn:
    """A Tag is what a recruiter files by, so two of one name in one scope is a clean 409."""
    refuse_duplicate(
        clash,
        *NAME_CONSTRAINTS,
        problem_type=TAG_NAME_TAKEN_PROBLEM_TYPE,
        detail=f"This tenant already has a tag called “{name}” in that scope.",
    )
