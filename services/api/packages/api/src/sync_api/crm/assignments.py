from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, NoReturn

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from sync_api.crm.access import (
    ReachableSubject,
    own_tag,
    reachable_application,
    reachable_candidate,
)
from sync_api.crm.payload import Tag
from sync_api.integrity import violated_constraint
from sync_api.problems import TAG_SCOPE_MISMATCH_PROBLEM_TYPE, Problem
from sync_core import get_logger, transaction
from sync_core.models import ApplicationTagAssignment, CandidateTagAssignment, TenantTag

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import InstrumentedAttribute

    from sync_api.tenants import ActingRecruiter

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Filing:
    """Where one kind of thing's Tags are kept, and how the tenant reaches the thing itself."""

    assignment: type[ApplicationTagAssignment] | type[CandidateTagAssignment]
    subject: InstrumentedAttribute[UUID]
    reachable: ReachableSubject
    scope_constraint: str


ON_APPLICATIONS = Filing(
    assignment=ApplicationTagAssignment,
    subject=ApplicationTagAssignment.application_id,
    reachable=reachable_application,
    scope_constraint="application_tag_assignments_tag_id_scope_fkey",
)

ON_CANDIDATES = Filing(
    assignment=CandidateTagAssignment,
    subject=CandidateTagAssignment.candidate_id,
    reachable=reachable_candidate,
    scope_constraint="candidate_tag_assignments_tag_id_scope_fkey",
)


class TagAssignmentService:
    """The Tags one kind of thing wears, put on and taken off by the Tenant that owns them."""

    def __init__(self, session: AsyncSession, filing: Filing) -> None:
        self._db = session
        self._filing = filing

    async def tags(self, recruiter: ActingRecruiter, subject_id: UUID) -> list[Tag]:
        await self._filing.reachable(self._db, recruiter.tenant.id, subject_id)
        assignment = self._filing.assignment
        rows = await self._db.scalars(
            select(TenantTag)
            .join(assignment, assignment.tag_id == TenantTag.id)
            .where(
                self._filing.subject == subject_id,
                assignment.tenant_id == recruiter.tenant.id,
            )
            .order_by(TenantTag.name)
        )
        return [Tag.of(row) for row in rows]

    async def put_on(self, recruiter: ActingRecruiter, subject_id: UUID, tag_id: UUID) -> Tag:
        await self._filing.reachable(self._db, recruiter.tenant.id, subject_id)
        # Read whole before the write: a refused insert rolls back, and a rolled-back row
        # cannot be read from again to say what was refused.
        tag = Tag.of(await own_tag(self._db, recruiter.tenant.id, tag_id))
        # `scope` is left to its column default, so the composite FK on (tag_id, scope) is what
        # decides whether this Tag belongs on this kind of thing. The check stays the database's.
        filing = insert(self._filing.assignment).values(
            tenant_id=recruiter.tenant.id,
            tag_id=tag_id,
            added_by_recruiter_id=recruiter.profile.id,
            **{self._filing.subject.key: subject_id},
        )
        try:
            async with transaction(self._db):
                await self._db.execute(filing.on_conflict_do_nothing())
        except IntegrityError as refused:
            _refuse_wrong_scope(refused, tag, self._filing.scope_constraint)

        logger.info(
            "crm.tag_assigned",
            tag_id=str(tag_id),
            subject_id=str(subject_id),
            tenant_id=str(recruiter.tenant.id),
        )
        return tag

    async def take_off(self, recruiter: ActingRecruiter, subject_id: UUID, tag_id: UUID) -> None:
        await self._filing.reachable(self._db, recruiter.tenant.id, subject_id)
        await own_tag(self._db, recruiter.tenant.id, tag_id)
        assignment = self._filing.assignment
        async with transaction(self._db):
            await self._db.execute(
                delete(assignment).where(
                    self._filing.subject == subject_id,
                    assignment.tag_id == tag_id,
                    assignment.tenant_id == recruiter.tenant.id,
                )
            )

        logger.info(
            "crm.tag_unassigned",
            tag_id=str(tag_id),
            subject_id=str(subject_id),
            tenant_id=str(recruiter.tenant.id),
        )


def _refuse_wrong_scope(refused: IntegrityError, tag: Tag, constraint: str) -> NoReturn:
    """The scope guard the schema carries, said in words the caller can act on."""
    if violated_constraint(refused) != constraint:
        raise refused
    raise Problem(
        status=409,
        type=TAG_SCOPE_MISMATCH_PROBLEM_TYPE,
        detail=f"“{tag.name}” is a {tag.scope.value} tag and cannot go on this.",
    ) from refused
