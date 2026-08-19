from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import AfterValidator

from sync_api.dependencies import JobBrowseServiceDep, VisitorDep
from sync_api.errors import openapi_problem
from sync_api.jobs import PublicJob, PublicJobPage
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.rate_limit import enforce_public_rate_limit
from sync_api.text import without_control_characters
from sync_core.models import EmploymentType, WorkMode
from sync_core.profile import MAX_LINE_LENGTH

ROUTER_PREFIX: Final = "/jobs"

TOO_MANY: Final[dict[int | str, dict[str, Any]]] = {
    429: openapi_problem("Too many requests from this address."),
}

router = APIRouter(
    prefix=ROUTER_PREFIX, tags=["public jobs"], dependencies=[Depends(enforce_public_rate_limit)]
)


@router.get(
    "",
    operation_id="browseJobs",
    summary="Published Jobs, newest first",
    responses={
        **TOO_MANY,
        422: openapi_problem(
            "`cursor` is not one this API issued, or `employment_type` or `work_mode` is not "
            "one of its set."
        ),
    },
)
async def browse_jobs(
    jobs: JobBrowseServiceDep,
    q: Annotated[
        str | None,
        Query(
            max_length=MAX_LINE_LENGTH,
            description='Words that must appear in the Job. Supports `"quoted phrases"`, '
            "`or` and `-excluded`.",
            examples=["backend engineer python"],
        ),
        AfterValidator(without_control_characters),
    ] = None,
    location_key: Annotated[
        str | None,
        Query(
            max_length=MAX_LINE_LENGTH,
            description="A Location's key, from `/v1/locations`. Matched exactly, so a "
            "governorate never answers for the one beside it — plus every remote Job that names "
            "no Location, because those can be done from here as well as from anywhere else.",
            examples=["sy-damascus"],
        ),
        AfterValidator(without_control_characters),
    ] = None,
    employment_type: Annotated[
        EmploymentType | None,
        Query(
            description="One of the platform's employment types. Anything else is refused "
            "rather than answered with an empty page.",
            examples=[EmploymentType.FULL_TIME],
        ),
    ] = None,
    work_mode: Annotated[
        WorkMode | None,
        Query(
            description="One of the platform's work modes, refused like `employment_type` when "
            "it is not. Every published Job answers this, so the filter never hides a Job that "
            "simply would not say.",
            examples=[WorkMode.REMOTE],
        ),
    ] = None,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> PublicJobPage:
    """Open roles anyone can read, no account needed.

    Every filter is a hard one, and `q` never changes the order: the newest Job is always first.
    """
    return await jobs.page(
        keywords=q,
        location_key=location_key,
        employment_type=employment_type,
        work_mode=work_mode,
        cursor=cursor,
        limit=limit,
    )


@router.get(
    "/by-link/{token}",
    operation_id="getJobByTrackedLink",
    summary="The Job a campaign link leads to",
    responses={**TOO_MANY, 404: openapi_problem("No live link has that token.")},
)
async def get_job_by_tracked_link(
    token: str, jobs: JobBrowseServiceDep, visitor: VisitorDep
) -> PublicJob:
    """Where a campaign link lands. The view is recorded against the link that brought it."""
    return await jobs.by_link(token, visitor)


@router.get(
    "/{job_id}",
    operation_id="getPublicJob",
    summary="One published Job",
    responses={**TOO_MANY, 404: openapi_problem("No published Job has that id.")},
)
async def get_public_job(job_id: UUID, jobs: JobBrowseServiceDep, visitor: VisitorDep) -> PublicJob:
    """Everything applying asks for, and never the answers a knockout question screens on.

    Reading a Job records a view: an anonymous session id and a salted hash, nothing that
    names the reader.
    """
    return await jobs.job(job_id, visitor)
