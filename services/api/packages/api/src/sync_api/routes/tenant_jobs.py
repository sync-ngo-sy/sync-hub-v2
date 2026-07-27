from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Query, status

from sync_api.dependencies import ActingRecruiterDep, JobServiceDep, TrackedLinkServiceDep
from sync_api.errors import openapi_problem
from sync_api.jobs import (
    JobChanges,
    JobCriteria,
    JobCriteriaView,
    JobPage,
    JobView,
    NewJob,
    NewTrackedLink,
    TrackedLink,
    TrackedLinkChanges,
)
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.problems import ValidationProblemDetail
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED
from sync_core.models import JobStatus

ROUTER_PREFIX: Final = "/tenants/me/jobs"

JOB_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("This tenant has no job with that id."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["jobs"])


@router.post(
    "",
    operation_id="createJob",
    summary="Write a new Job",
    status_code=status.HTTP_201_CREATED,
    responses=TENANT_ACCESS_REFUSED,
)
async def create_job(body: NewJob, recruiter: ActingRecruiterDep, jobs: JobServiceDep) -> JobView:
    """Create the Job as a draft. Nobody outside the tenant sees it until it is published."""
    return await jobs.create(recruiter, body)


@router.get(
    "",
    operation_id="listJobs",
    summary="The tenant's Jobs, newest first",
    responses={
        **TENANT_ACCESS_REFUSED,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_jobs(
    recruiter: ActingRecruiterDep,
    jobs: JobServiceDep,
    job_status: Annotated[
        JobStatus | None,
        Query(alias="status", description="Only Jobs in this state."),
    ] = None,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> JobPage:
    """Every Job of the tenant, whatever its state. Page with `next_cursor`."""
    return await jobs.page(recruiter, status=job_status, cursor=cursor, limit=limit)


@router.get(
    "/{job_id}",
    operation_id="getJob",
    summary="One Job, criteria and all",
    responses={**TENANT_ACCESS_REFUSED, **JOB_NOT_FOUND},
)
async def get_job(job_id: UUID, recruiter: ActingRecruiterDep, jobs: JobServiceDep) -> JobView:
    """The whole Job. `criteria_locked` says whether the criteria form is still editable."""
    return await jobs.job(recruiter, job_id)


@router.patch(
    "/{job_id}",
    operation_id="changeJob",
    summary="Edit a Job or move it through its lifecycle",
    responses={
        **TENANT_ACCESS_REFUSED,
        **JOB_NOT_FOUND,
        409: openapi_problem("The Job cannot move to that status from the one it is in."),
    },
)
async def change_job(
    job_id: UUID, body: JobChanges, recruiter: ActingRecruiterDep, jobs: JobServiceDep
) -> JobView:
    """Change what you send and nothing else. The prose stays editable after applications land."""
    return await jobs.change(recruiter, job_id, body)


@router.put(
    "/{job_id}/criteria",
    operation_id="replaceJobCriteria",
    summary="Replace what the Job screens on",
    responses={
        **TENANT_ACCESS_REFUSED,
        **JOB_NOT_FOUND,
        409: openapi_problem("The Job has applications, so its criteria are frozen."),
        422: openapi_problem(
            "A skill is not a Canonical skill, or a language code is not one the platform "
            "knows. Both name the offending entries.",
            ValidationProblemDetail,
        ),
    },
)
async def replace_job_criteria(
    job_id: UUID, body: JobCriteria, recruiter: ActingRecruiterDep, jobs: JobServiceDep
) -> JobCriteriaView:
    """Replace the criteria whole — an omitted section is an emptied one.

    Editable only until the Job's first Application: every applicant is judged by one bar.
    """
    return await jobs.replace_criteria(recruiter, job_id, body)


@router.post(
    "/{job_id}/links",
    operation_id="createTrackedJobLink",
    summary="Name a campaign link to the Job",
    status_code=status.HTTP_201_CREATED,
    responses={
        **TENANT_ACCESS_REFUSED,
        **JOB_NOT_FOUND,
        409: openapi_problem("This Job already has a link by that name."),
    },
)
async def create_tracked_job_link(
    job_id: UUID,
    body: NewTrackedLink,
    recruiter: ActingRecruiterDep,
    links: TrackedLinkServiceDep,
) -> TrackedLink:
    """Mint a link whose `token` attributes every view and application it brings to its name."""
    return await links.create(recruiter, job_id, body)


@router.get(
    "/{job_id}/links",
    operation_id="listTrackedJobLinks",
    summary="The Job's campaign links and their traffic",
    responses={**TENANT_ACCESS_REFUSED, **JOB_NOT_FOUND},
)
async def list_tracked_job_links(
    job_id: UUID, recruiter: ActingRecruiterDep, links: TrackedLinkServiceDep
) -> list[TrackedLink]:
    """Every link of the Job, oldest first, each with the views it has brought."""
    return await links.links(recruiter, job_id)


@router.patch(
    "/{job_id}/links/{link_id}",
    operation_id="changeTrackedJobLink",
    summary="Rename a campaign link or turn it off",
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem("This tenant has no such Job, or the Job has no such link."),
        409: openapi_problem("This Job already has a link by that name."),
    },
)
async def change_tracked_job_link(
    job_id: UUID,
    link_id: UUID,
    body: TrackedLinkChanges,
    recruiter: ActingRecruiterDep,
    links: TrackedLinkServiceDep,
) -> TrackedLink:
    """Turning a link off stops it resolving; the views it already brought stay counted."""
    return await links.change(recruiter, job_id, link_id, body)
