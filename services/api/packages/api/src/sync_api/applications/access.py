from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, select

from sync_api.problems import APPLICATION_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core.models import Application, Job, Tenant

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True, slots=True)
class Applied:
    """One Application and what it was sent to — the context a move and a review both need."""

    application: Application
    job: Job
    tenant_name: str


async def own_application(session: AsyncSession, tenant_id: UUID, application_id: UUID) -> Applied:
    """The tenant's own. Another tenant's Application and a nonexistent one are the same 404."""
    return await _applied(
        session,
        Application.id == application_id,
        Application.tenant_id == tenant_id,
        missing="No application of this tenant has that id.",
    )


async def my_application(
    session: AsyncSession, candidate_id: UUID, application_id: UUID
) -> Applied:
    """The caller's own. Somebody else's Application and a nonexistent one are the same 404."""
    return await _applied(
        session,
        Application.id == application_id,
        Application.candidate_id == candidate_id,
        missing="No application of yours has that id.",
    )


async def _applied(session: AsyncSession, *scope: ColumnElement[bool], missing: str) -> Applied:
    found = (
        (
            await session.execute(
                select(Application, Job, Tenant)
                .join(Job, Job.id == Application.job_id)
                .join(Tenant, Tenant.id == Application.tenant_id)
                .where(*scope)
            )
        )
        .tuples()
        .first()
    )
    if found is None:
        raise Problem(status=404, type=APPLICATION_NOT_FOUND_PROBLEM_TYPE, detail=missing)
    application, job, tenant = found
    return Applied(application=application, job=job, tenant_name=tenant.name)
