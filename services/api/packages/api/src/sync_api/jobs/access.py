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


async def own_job(
    session: AsyncSession, tenant_id: UUID, job_id: UUID, *, lock: bool = False
) -> Job:
    """The tenant's own Job. Another tenant's Job and a nonexistent one are the same 404.

    `lock` takes the row `FOR UPDATE`, which a caller about to read the status and then write it
    needs: the lifecycle is a check followed by an act, and nothing in the schema serializes the
    two. Without it, two status changes decided at once both pass the check each was entitled to
    fail, and an archived Job comes back published through a transition the state machine forbids.
    """
    query = select(Job).where(Job.id == job_id, Job.tenant_id == tenant_id).options(*WITH_LOCATION)
    if lock:
        query = query.with_for_update()

    job = await session.scalar(query)
    if job is None:
        raise Problem(
            status=404,
            type=JOB_NOT_FOUND_PROBLEM_TYPE,
            detail="No job of this tenant has that id.",
        )
    return job


async def lock_the_criteria(session: AsyncSession, job: Job) -> None:
    """Hold the Job's row until this transaction ends, and re-read the one criterion stored on it.

    The Job row is what the Job's criteria are locked under. Replacing them takes it, and
    screening an Application against them takes it, so the two cannot interleave: without it, a
    replacement committed between Screening reading the criteria and writing its verdict leaves a
    verdict citing requirements the Job no longer has. The trigger that freezes criteria once a
    Job has Applications cannot catch that on its own — at the moment it fires, the Application
    being screened does not exist yet.

    Only `minimum_total_experience_years` is re-read, because it is the one criterion living on
    this row. Refreshing the whole Job would expire the Location loaded with it, and the next
    reader of that is a payload, under asyncio, where a lazy load raises rather than loads.
    """
    await session.refresh(job, ["minimum_total_experience_years"], with_for_update=True)


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
