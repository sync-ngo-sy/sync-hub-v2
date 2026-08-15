from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.applications.payload import ClaimedHire
from sync_api.problems import (
    HIRE_CLAIM_ALREADY_ANSWERED_PROBLEM_TYPE,
    HIRE_CLAIM_NOT_FOUND_PROBLEM_TYPE,
    Problem,
)
from sync_core.models import HireClaim, HireConfirmation

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from datetime import date
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession


async def claim_the_hire(
    session: AsyncSession,
    *,
    application_id: UUID,
    tenant_id: UUID,
    recruiter_id: UUID,
    status_history_id: UUID,
    start_date: date,
) -> HireClaim:
    """Record what the Tenant says happened. Nothing here makes it a Placement — the Candidate
    does that, or does not."""
    claim = HireClaim(
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
) -> ClaimedHire:
    """The Candidate's yes or no, which they give once.

    The row is taken for update first: two answers decided at once would otherwise both read an
    unanswered claim, and the second would rewrite the first's.
    """
    claim = await session.scalar(
        select(HireClaim).where(HireClaim.application_id == application_id).with_for_update()
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


async def claimed_hire(session: AsyncSession, application_id: UUID) -> ClaimedHire | None:
    claim = await session.get(HireClaim, application_id)
    return None if claim is None else as_payload(claim)


async def claimed_hires(
    session: AsyncSession, application_ids: Sequence[UUID]
) -> Mapping[UUID, ClaimedHire]:
    """Every claim on a page of Applications, in one read rather than one per row."""
    if not application_ids:
        return {}
    claims = await session.scalars(
        select(HireClaim).where(HireClaim.application_id.in_(application_ids))
    )
    return {claim.application_id: as_payload(claim) for claim in claims}


def as_payload(claim: HireClaim) -> ClaimedHire:
    return ClaimedHire(
        start_date=claim.start_date,
        confirmation=claim.confirmation,
        claimed_at=claim.claimed_at,
        answered_at=claim.answered_at,
    )
