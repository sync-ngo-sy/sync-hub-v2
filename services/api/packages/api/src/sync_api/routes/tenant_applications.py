from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from sync_api.applications import (
    ApplicationReview,
    ApplicationStatusChange,
    MatchAssessment,
    MatchAssessmentPage,
    MovedApplication,
)
from sync_api.dependencies import (
    ActingRecruiterDep,
    ApplicationReviewServiceDep,
    MatchAssessmentServiceDep,
)
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.rate_limit import enforce_assessment_rate_limit
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/tenants/me/applications"

APPLICATION_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("This tenant has no application with that id."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["applications"])


@router.get(
    "/{application_id}",
    operation_id="getApplication",
    summary="One Application, whole",
    responses={
        **TENANT_ACCESS_REFUSED,
        **APPLICATION_NOT_FOUND,
        502: openapi_problem("The stored CV file could not be reached."),
    },
)
async def get_application(
    application_id: UUID,
    recruiter: ActingRecruiterDep,
    applications: ApplicationReviewServiceDep,
) -> ApplicationReview:
    """The Snapshot, the answers, the Screening verdict, the history, and a link to the CV.

    `snapshot` is what the candidate reviewed when they applied, not what their profile says
    today. `cv.download_url` is short-lived: read this again rather than storing it.
    """
    return await applications.review(recruiter, application_id)


@router.patch(
    "/{application_id}",
    operation_id="changeApplicationStatus",
    summary="Move an Application through the pipeline",
    responses={
        **TENANT_ACCESS_REFUSED,
        **APPLICATION_NOT_FOUND,
        409: openapi_problem(
            "The Application cannot move there from where it is: `hired` and `withdrawn` are "
            "final, a `rejected` one can only be taken back to `reviewing`, and only the "
            "candidate withdraws."
        ),
    },
)
async def change_application_status(
    application_id: UUID,
    body: ApplicationStatusChange,
    recruiter: ActingRecruiterDep,
    applications: ApplicationReviewServiceDep,
) -> MovedApplication:
    """Move it anywhere the pipeline allows, backwards included, and tell the candidate.

    Every move notifies them in-app; a rejection also queues the one email a human decision
    earns. The Screening verdict is untouched, whatever the Application's status becomes.
    """
    return await applications.move(recruiter, application_id, body)


@router.post(
    "/{application_id}/assessments",
    operation_id="assessApplicationMatch",
    summary="Ask an AI how well the Application answers the Job",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_assessment_rate_limit)],
    responses={
        **TENANT_ACCESS_REFUSED,
        **APPLICATION_NOT_FOUND,
        429: openapi_problem(
            "The tenant has asked for too many assessments. `Retry-After` says how long to wait."
        ),
        502: openapi_problem("The model could not assess it. Nothing was recorded."),
        503: openapi_problem("This deployment has no assessment model configured."),
    },
)
async def assess_application_match(
    application_id: UUID,
    recruiter: ActingRecruiterDep,
    assessments: MatchAssessmentServiceDep,
) -> MatchAssessment:
    """A percentage and an explanation, drawn from the Snapshot and the Job's criteria.

    Advice, and only that: it never touches the Screening verdict, and it reads what the
    candidate froze when they applied rather than their profile as it stands today. Each
    call appends another assessment; none of them replaces the last.
    """
    return await assessments.assess(recruiter, application_id)


@router.get(
    "/{application_id}/assessments",
    operation_id="listApplicationMatchAssessments",
    summary="Every AI match assessment of the Application, newest first",
    responses={
        **TENANT_ACCESS_REFUSED,
        **APPLICATION_NOT_FOUND,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_application_match_assessments(
    application_id: UUID,
    recruiter: ActingRecruiterDep,
    assessments: MatchAssessmentServiceDep,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> MatchAssessmentPage:
    """The whole history, each entry with the model and prompt version that wrote it."""
    return await assessments.page(recruiter, application_id, cursor=cursor, limit=limit)
