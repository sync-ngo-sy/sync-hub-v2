from __future__ import annotations

from typing import Any, Final
from uuid import UUID

from fastapi import APIRouter

from sync_api.applications import ApplicationReview, ApplicationStatusChange, MovedApplication
from sync_api.dependencies import ActingRecruiterDep, ApplicationReviewServiceDep
from sync_api.errors import openapi_problem
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
