from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Query, status

from sync_api.applications import Application, ApplicationPage, NewApplication
from sync_api.dependencies import ActingCandidateDep, ApplicationServiceDep, VisitorDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.problems import ApplicationConflictProblemDetail, ValidationProblemDetail
from sync_api.routes.candidates import CANDIDATE_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/applications"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["applications"])

SUBMISSION_REFUSED: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("No published Job has that id, or no CV of yours has that id."),
    409: openapi_problem(
        "You have already applied to this job — `application_id` is the one you sent, and a "
        "withdrawn Application still counts — or the CV you picked has not finished parsing, "
        "or the reviewed data opts in to Global search without a current, ready CV.",
        ApplicationConflictProblemDetail,
    ),
    422: openapi_problem(
        "The answers do not match the questions the Job asks, or the reviewed data names a "
        "skill or a language the platform does not know. All of them name the offending "
        "entries.",
        ValidationProblemDetail,
    ),
}


@router.post(
    "",
    operation_id="submitApplication",
    summary="Apply to a Job",
    status_code=status.HTTP_201_CREATED,
    responses={**CANDIDATE_ACCESS_REFUSED, **SUBMISSION_REFUSED},
)
async def submit_application(
    body: NewApplication,
    candidate: ActingCandidateDep,
    visitor: VisitorDep,
    applications: ApplicationServiceDep,
) -> Application:
    """Submit the Application, Snapshot, answers and Screening verdict in one transaction.

    Nothing partial is ever observable: either the whole submission lands, verdict included,
    or none of it did. Where the browser reached this Job through a campaign link, the
    Application is attributed to it.
    """
    return await applications.submit(candidate, visitor, body)


@router.get(
    "",
    operation_id="listMyApplications",
    summary="The caller's Applications, newest first",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_my_applications(
    candidate: ActingCandidateDep,
    applications: ApplicationServiceDep,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> ApplicationPage:
    """Every Job applied to and where it stands. Page with `next_cursor`."""
    return await applications.page(candidate, cursor=cursor, limit=limit)
