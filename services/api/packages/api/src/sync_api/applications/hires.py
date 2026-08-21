from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import func, select

from sync_api.applications.payload import (
    ApplicationJob,
    HireClaim,
    HireClaimCount,
    TenantHireClaim,
    TenantHireClaimPage,
)
from sync_api.jobs.access import WITH_LOCATION
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import (
    HIRE_CLAIM_ALREADY_ANSWERED_PROBLEM_TYPE,
    HIRE_CLAIM_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core.models import (
    Application,
    ApplicationProfileSnapshot,
    HireConfirmation,
    Job,
    t_placements,
)
from sync_core.models import HireClaim as HireClaimRow

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from datetime import date
    from uuid import UUID

    from sqlalchemy import Select, SQLColumnExpression
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter


async def claim_the_hire(
    session: AsyncSession,
    *,
    application_id: UUID,
    tenant_id: UUID,
    recruiter_id: UUID,
    status_history_id: UUID,
    start_date: date,
) -> HireClaimRow:
    """Record what the Tenant says happened. Nothing here makes it a Placement — the Candidate
    does that, or does not."""
    claim = HireClaimRow(
        application_id=application_id,
        tenant_id=tenant_id,
        claimed_by_recruiter_id=recruiter_id,
        status_history_id=status_history_id,
        start_date=start_date,
    )
    session.add(claim)
    await session.flush()
    return claim


async def answer_the_claim(
    session: AsyncSession, application_id: UUID, *, confirmed: bool
) -> HireClaim:
    """The Candidate's yes or no, which they give once.

    The row is taken for update first: two answers decided at once would otherwise both read an
    unanswered claim, and the second would rewrite the first's.
    """
    claim = await session.scalar(
        select(HireClaimRow).where(HireClaimRow.application_id == application_id).with_for_update()
    )
    if claim is None:
        raise Problem(
            status=404,
            type=HIRE_CLAIM_NOT_FOUND_PROBLEM_TYPE,
            detail="Nobody has said they hired you for this job.",
        )
    if claim.confirmation is not HireConfirmation.UNANSWERED:
        raise Problem(
            status=409,
            type=HIRE_CLAIM_ALREADY_ANSWERED_PROBLEM_TYPE,
            detail="You have already answered this. An answer is given once and stands.",
        )

    claim.confirmation = HireConfirmation.CONFIRMED if confirmed else HireConfirmation.DENIED
    claim.answered_at = datetime.now(UTC)
    await session.flush()
    return as_payload(claim)


async def claimed_hire(session: AsyncSession, application_id: UUID) -> HireClaim | None:
    claim = await session.get(HireClaimRow, application_id)
    return None if claim is None else as_payload(claim)


async def claimed_hires(
    session: AsyncSession, application_ids: Sequence[UUID]
) -> Mapping[UUID, HireClaim]:
    """Every claim on a page of Applications, in one read rather than one per row."""
    if not application_ids:
        return {}
    claims = await session.scalars(
        select(HireClaimRow).where(HireClaimRow.application_id.in_(application_ids))
    )
    return {claim.application_id: as_payload(claim) for claim in claims}


def as_payload(claim: HireClaimRow) -> HireClaim:
    return HireClaim(
        start_date=claim.start_date,
        confirmation=claim.confirmation,
        claimed_at=claim.claimed_at,
        answered_at=claim.answered_at,
    )


class HireClaimService:
    """The Tenant's own reading of the hires it has claimed: every claim it has made, whichever
    Job it was made on, one confirmation at a time.

    Nothing here decides anything. A claim nobody has answered waits for as long as it waits —
    the list says how old it is and a Recruiter judges the silence for themselves.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def page(
        self,
        recruiter: ActingRecruiter,
        *,
        confirmation: HireConfirmation = HireConfirmation.CONFIRMED,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> TenantHireClaimPage:
        """One confirmation's worth of claims, newest claim first, with all three counted.

        The counts are taken whatever `confirmation` narrows the list to, so the one being read
        never hides the size of the other two.
        """
        reading = _claims_of(recruiter.tenant.id, confirmation)
        found = (
            await self._db.execute(
                newest_first(
                    reading.query,
                    created_at=reading.claimed_at,
                    id_=reading.application_id,
                    cursor=cursor,
                    limit=limit,
                    cursor_order=confirmation.value,
                )
            )
        ).all()
        rows, next_cursor = page_of(
            found,
            limit=limit,
            cursor_for=lambda row: Cursor(
                created_at=row.claimed_at, id=row.application_id, order=confirmation.value
            ),
        )
        return TenantHireClaimPage(
            items=[_as_tenant_payload(row, confirmation) for row in rows],
            next_cursor=next_cursor,
            counts=await self._counts(recruiter.tenant.id),
        )

    async def _counts(self, tenant_id: UUID) -> list[HireClaimCount]:
        """Counted where each is read from, and for the same reason: the confirmed one through
        the view that *is* the definition of a Placement, its two siblings on the claims."""
        confirmed = await self._db.scalar(
            select(func.count())
            .select_from(t_placements)
            .where(t_placements.c.tenant_id == tenant_id)
        )
        unanswered_and_denied = dict(
            (
                await self._db.execute(
                    select(HireClaimRow.confirmation, func.count())
                    .where(
                        HireClaimRow.tenant_id == tenant_id,
                        HireClaimRow.confirmation.in_(
                            [HireConfirmation.UNANSWERED, HireConfirmation.DENIED]
                        ),
                    )
                    .group_by(HireClaimRow.confirmation)
                )
            )
            .tuples()
            .all()
        )
        counted = {HireConfirmation.CONFIRMED: confirmed or 0, **unanswered_and_denied}
        return [
            HireClaimCount(confirmation=answer, count=counted.get(answer, 0))
            for answer in HireConfirmation
        ]


@dataclass(frozen=True, slots=True)
class _Claims:
    """One confirmation's rows, and the two columns a page of them resumes on."""

    query: Select[Any]
    claimed_at: SQLColumnExpression[datetime]
    application_id: SQLColumnExpression[UUID]


def _claims_of(tenant_id: UUID, confirmation: HireConfirmation) -> _Claims:
    """Where one confirmation reads from.

    `confirmed` reads the `placements` view because that view *is* what a Placement is; the
    other two read `hire_claims`, which is where a claim that is not a Placement is the only
    kind of row there is. Reading a view for one and a table for its siblings is what keeps
    "confirmed" one definition, held by the database, rather than a second one written here.
    """
    if confirmation is HireConfirmation.CONFIRMED:
        placement = t_placements.c
        return _Claims(
            query=_with_what_a_row_shows(
                application_id=placement.application_id,
                start_date=placement.start_date,
                claimed_at=placement.claimed_at,
                answered_at=placement.confirmed_at,
            ).where(placement.tenant_id == tenant_id),
            claimed_at=placement.claimed_at,
            application_id=placement.application_id,
        )
    return _Claims(
        query=_with_what_a_row_shows(
            application_id=HireClaimRow.application_id,
            start_date=HireClaimRow.start_date,
            claimed_at=HireClaimRow.claimed_at,
            answered_at=HireClaimRow.answered_at,
        ).where(HireClaimRow.tenant_id == tenant_id, HireClaimRow.confirmation == confirmation),
        claimed_at=HireClaimRow.claimed_at,
        application_id=HireClaimRow.application_id,
    )


def _with_what_a_row_shows(
    *,
    application_id: SQLColumnExpression[UUID],
    start_date: SQLColumnExpression[date],
    claimed_at: SQLColumnExpression[datetime],
    answered_at: SQLColumnExpression[datetime | None],
) -> Select[Any]:
    """A claim, the person it names and the Job it was made on — the whole of what a row shows.

    The name is the Snapshot's, as every other list of applicants reads it: who they applied
    as, rather than what their profile says today.
    """
    return (
        select(
            application_id.label("application_id"),
            start_date.label("start_date"),
            claimed_at.label("claimed_at"),
            answered_at.label("answered_at"),
            ApplicationProfileSnapshot.full_name,
            Job,
        )
        .options(*WITH_LOCATION)
        .join(Application, Application.id == application_id)
        .join(Job, Job.id == Application.job_id)
        .join(
            ApplicationProfileSnapshot,
            ApplicationProfileSnapshot.application_id == application_id,
        )
    )


def _as_tenant_payload(row: Any, confirmation: HireConfirmation) -> TenantHireClaim:
    """Every row answered for holds that answer, so the list says which rather than reading a
    column back — which on the `placements` view there is not one of."""
    return TenantHireClaim(
        application_id=row.application_id,
        candidate_name=row.full_name,
        job=ApplicationJob.of(row.Job),
        start_date=row.start_date,
        confirmation=confirmation,
        claimed_at=row.claimed_at,
        answered_at=row.answered_at,
    )
