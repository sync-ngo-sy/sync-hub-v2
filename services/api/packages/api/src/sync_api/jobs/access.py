from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import selectinload

from sync_api.problems import JOB_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core.models import Job, JobStatus, Tenant

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession


#: A Job is read to be shown, and showing one names its Location — so every read that reaches
#: a payload brings the Location with it rather than leaving a lazy load to fail under asyncio.
WITH_LOCATION: Final = (selectinload(Job.location),)


def location_name(job: Job) -> str | None:
    """What the Job's Location is called, for a Job loaded `WITH_LOCATION`. None when the Job
    says where it is nowhere, which is what a payload shows as no place at all."""
    return job.location.name if job.location else None


async def own_job(session: AsyncSession, tenant_id: UUID, job_id: UUID) -> Job:
    """The tenant's own Job. Another tenant's Job and a nonexistent one are the same 404."""
    job = await session.scalar(
        select(Job).where(Job.id == job_id, Job.tenant_id == tenant_id).options(*WITH_LOCATION)
    )
    if job is None:
        raise Problem(
            status=404,
            type=JOB_NOT_FOUND_PROBLEM_TYPE,
            detail="No job of this tenant has that id.",
        )
    return job


def public_jobs() -> Select[tuple[Job, Tenant]]:
    """Published, unexpired, and belonging to a tenant the platform has not suspended.

    The one definition of a Job the world can see: what a visitor may read, and what a
    Candidate may apply to.
    """
    return (
        select(Job, Tenant)
        .options(*WITH_LOCATION)
        .join(Tenant, Tenant.id == Job.tenant_id)
        .where(
            Job.status == JobStatus.PUBLISHED,
            Tenant.is_active.is_(True),
            or_(Job.expires_at.is_(None), Job.expires_at > func.now()),
        )
    )


async def open_job(session: AsyncSession, job_id: UUID) -> tuple[Job, Tenant]:
    """The Job behind a public id. One nobody may read is one nobody may apply to."""
    found = (await session.execute(public_jobs().where(Job.id == job_id))).tuples().first()
    if found is None:
        raise Problem(
            status=404,
            type=JOB_NOT_FOUND_PROBLEM_TYPE,
            detail="No published job has that id.",
        )
    return found
