from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Query, status

from sync_api.applications import (
    Application,
    ApplicationPage,
    HireAnswer,
    HireClaim,
    NewApplication,
    WithdrawnApplication,
)
from sync_api.dependencies import ActingCandidateDep, ApplicationServiceDep, VisitorDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.problems import (
    ApplicationConflictProblemDetail,
    SubmissionRefusedProblemDetail,
)
from sync_api.routes.candidates import CANDIDATE_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/applications"

router = APIRouter(prefix=ROUTER_PREFIX, tags=["applications"])

SUBMISSION_REFUSED: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("No published Job has that id."),
    409: openapi_problem(
        "You have already applied to this job — `application_id` is the one you sent, and a "
        "withdrawn Application still counts — or you have no current CV to apply with.",
        ApplicationConflictProblemDetail,
    ),
    422: openapi_problem(
        "The answers do not match the questions the Job asks, and `errors` names the offending "
        "entries; or your profile is too thin to apply with, and `detail` says what is missing.",
        SubmissionRefusedProblemDetail,
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

    The Snapshot is copied from the caller's live profile and the CV they currently hold —
    neither is in the request. Nothing partial is ever observable: either the whole submission
    lands, verdict included, or none of it did. Where the browser reached this Job through a
    campaign link, the Application is attributed to it.
    """
    return await applications.submit(candidate, visitor, body)


@router.post(
    "/{application_id}/withdraw",
    operation_id="withdrawMyApplication",
    summary="Withdraw from a Job, for good",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        404: openapi_problem("No Application of the caller's has that id."),
        409: openapi_problem(
            "The Application has reached an outcome the Candidate has been told of, or they "
            "have already left it. Withdrawal is final: it cannot be undone, and the Job "
            "cannot be applied to again."
        ),
    },
)
async def withdraw_my_application(
    application_id: UUID,
    candidate: ActingCandidateDep,
    applications: ApplicationServiceDep,
) -> WithdrawnApplication:
    """Leave the process. This is irreversible, and re-applying to that Job is impossible."""
    return await applications.withdraw(candidate, application_id)


@router.post(
    "/{application_id}/hire",
    operation_id="answerHireClaim",
    summary="Confirm or deny that you were hired",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        404: openapi_problem(
            "No Application of the caller's has that id, or nobody has claimed to have hired "
            "them for it."
        ),
        409: openapi_problem("The claim has already been answered. An answer is given once."),
    },
)
async def answer_hire_claim(
    application_id: UUID,
    body: HireAnswer,
    candidate: ActingCandidateDep,
    applications: ApplicationServiceDep,
) -> HireClaim:
    """A Tenant says it hired the caller and names the day. This is the caller's answer.

    Only a yes makes it a Placement; a no leaves the Tenant's claim on record as a claim, and
    moves nothing. The Application stays where the Tenant put it either way — what happened is
    the Recruiter's to record, and whether it is true is the Candidate's to say.
    """
    return await applications.answer_hire(candidate, application_id, body)


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
