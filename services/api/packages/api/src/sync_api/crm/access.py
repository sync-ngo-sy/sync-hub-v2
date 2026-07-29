from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import or_, select

from sync_api.applications.access import own_application
from sync_api.problems import (
    CANDIDATE_NOT_FOUND_PROBLEM_TYPE,
    TAG_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core.models import (
    Application,
    Candidate,
    CandidateTagAssignment,
    Note,
    TalentPoolMember,
    TenantTag,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from uuid import UUID

    from sqlalchemy import ColumnElement
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
    """A Candidate this Tenant has met: one who applied to it, one Global search shows the
    world, or one it has already filed. Anybody else reads as absent, so candidate ids cannot
    be probed.

    That last clause is what keeps a record the Tenant made its own to read and undo: a
    Candidate who opts back out of Global search would otherwise strand the notes, tags and
    pool entry the Tenant wrote while it could still see them.

    Deletion is the one case it does not cover whole. A Talent pool is a discovery artifact, so
    `CandidateDeletion` purges the entry outright — a Tenant whose only anchor was the pool loses
    reach with it. The notes and tags it wrote survive and go on anchoring, because those are
    what it actually authored.
    """
    applied = (
        select(Application.id)
        .where(Application.tenant_id == tenant_id, Application.candidate_id == candidate_id)
        .exists()
    )
    in_sight = (
        select(Candidate.id)
        .where(
            Candidate.id == candidate_id,
            Candidate.deleted_at.is_(None),
            or_(Candidate.is_searchable, applied),
        )
        .exists()
    )
    if not await session.scalar(select(or_(in_sight, _already_filed(tenant_id, candidate_id)))):
        raise Problem(
            status=404,
            type=CANDIDATE_NOT_FOUND_PROBLEM_TYPE,
            detail="No candidate this tenant can reach has that id.",
        )


def _already_filed(tenant_id: UUID, candidate_id: UUID) -> ColumnElement[bool]:
    """Whether this Tenant has written anything of its own about this Candidate."""
    return or_(
        select(Note.id)
        .where(Note.tenant_id == tenant_id, Note.candidate_id == candidate_id)
        .exists(),
        select(CandidateTagAssignment.tag_id)
        .where(
            CandidateTagAssignment.tenant_id == tenant_id,
            CandidateTagAssignment.candidate_id == candidate_id,
        )
        .exists(),
        select(TalentPoolMember.candidate_id)
        .where(
            TalentPoolMember.tenant_id == tenant_id,
            TalentPoolMember.candidate_id == candidate_id,
        )
        .exists(),
    )
