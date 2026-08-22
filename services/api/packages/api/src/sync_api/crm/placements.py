from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.applications import ApplicationJob, CandidatePlacement
from sync_api.crm.access import reachable_candidate
from sync_api.jobs.access import WITH_LOCATION
from sync_core.models import Application, Job, t_placements

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter


class PlacementService:
    """The Placements one Tenant has made of one Candidate — the card their CRM profile shows
    beside the Talent pool, the Tags and the Notes.

    Both halves of the scoping are the `placements` view's own: the view *is* what a Placement
    is, so a claim nobody has confirmed is left out without this asking for confirmed ones, and
    the view carries the Tenant that claimed the hire, so another Tenant's Placement of the same
    person is left out without a second filter saying so. The profile is cross-tenant and this
    card is not, which is the same shape the three cards beside it already have.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def of_candidate(
        self, recruiter: ActingRecruiter, candidate_id: UUID
    ) -> list[CandidatePlacement]:
        """Newest start first, and the newer claim first where two of them start on one day:
        the day each row shows is the day they are ordered by, so a short list is never arranged
        by something the reader cannot see."""
        await reachable_candidate(self._db, recruiter.tenant.id, candidate_id)
        placement = t_placements.c
        placed = await self._db.execute(
            select(placement.application_id, placement.start_date, Job)
            .options(*WITH_LOCATION)
            .join(Application, Application.id == placement.application_id)
            .join(Job, Job.id == Application.job_id)
            .where(
                placement.tenant_id == recruiter.tenant.id,
                Application.candidate_id == candidate_id,
            )
            .order_by(placement.start_date.desc(), placement.claimed_at.desc())
        )
        return [
            CandidatePlacement(
                application_id=row.application_id,
                job=ApplicationJob.of(row.Job),
                start_date=row.start_date,
            )
            for row in placed
        ]
