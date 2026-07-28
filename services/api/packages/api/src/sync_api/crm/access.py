from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import or_, select

from sync_api.applications.access import own_application
from sync_api.problems import (
    CANDIDATE_NOT_FOUND_PROBLEM_TYPE,
    TAG_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core.models import Application, Candidate, TenantTag

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

#: Answers "may this tenant keep a record on that?" — and raises the 404 where it may not.
type ReachableSubject = Callable[[AsyncSession, UUID, UUID], Awaitable[None]]


async def own_tag(session: AsyncSession, tenant_id: UUID, tag_id: UUID) -> TenantTag:
    """The tenant's own. Another tenant's Tag and a nonexistent one are the same 404."""
    tag = await session.scalar(
        select(TenantTag).where(TenantTag.id == tag_id, TenantTag.tenant_id == tenant_id)
    )
    if tag is None:
        raise Problem(
            status=404,
            type=TAG_NOT_FOUND_PROBLEM_TYPE,
            detail="No tag of this tenant has that id.",
        )
    return tag


async def reachable_application(
    session: AsyncSession, tenant_id: UUID, application_id: UUID
) -> None:
    await own_application(session, tenant_id, application_id)


async def reachable_candidate(session: AsyncSession, tenant_id: UUID, candidate_id: UUID) -> None:
    """A Candidate this Tenant has actually met: one who applied to it, or one who opted in to
    Global search. Anybody else reads as absent, so candidate ids cannot be probed."""
    applied = (
        select(Application.id)
        .where(Application.tenant_id == tenant_id, Application.candidate_id == candidate_id)
        .exists()
    )
    reachable = await session.scalar(
        select(Candidate.id).where(
            Candidate.id == candidate_id,
            Candidate.deleted_at.is_(None),
            or_(Candidate.is_searchable, applied),
        )
    )
    if reachable is None:
        raise Problem(
            status=404,
            type=CANDIDATE_NOT_FOUND_PROBLEM_TYPE,
            detail="No candidate this tenant can reach has that id.",
        )
