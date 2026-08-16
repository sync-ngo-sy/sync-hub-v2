from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from sync_api.applications import (
    ApplicationReview,
    ApplicationSort,
    ApplicationStatusChange,
    MatchAssessment,
    MatchAssessmentPage,
    MovedApplication,
    ReceivedWithin,
    TenantApplicationPage,
)
from sync_api.crm import NewNote, Note, NoteChanges, NotePage, Tag
from sync_api.dependencies import (
    ActingRecruiterDep,
    ApplicationNotesDep,
    ApplicationReviewServiceDep,
    ApplicationTagsDep,
    MatchAssessmentServiceDep,
    OutreachServiceDep,
)
from sync_api.errors import openapi_problem
from sync_api.messaging import OutgoingMessage, QueuedMessage
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.rate_limit import enforce_assessment_rate_limit
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED
from sync_core.models import ApplicationStatus, QualificationStatus

ROUTER_PREFIX: Final = "/tenants/me/applications"

APPLICATION_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("This tenant has no application with that id."),
}

NOTE_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("This tenant has no application, or no note on it, with that id."),
}

ASSESSMENT_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("This tenant has no application, or no assessment of it, with that id."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["applications"])


@router.get(
    "",
    operation_id="listTenantApplications",
    summary="The tenant's Applications, newest first unless another order is asked for",
    responses={
        **TENANT_ACCESS_REFUSED,
        422: openapi_problem("`cursor` is not one this API issued, or belongs to another `sort`."),
    },
)
async def list_tenant_applications(
    recruiter: ActingRecruiterDep,
    applications: ApplicationReviewServiceDep,
    application_statuses: Annotated[
        list[ApplicationStatus] | None,
        Query(
            alias="status",
            description="Only Applications in one of these pipeline states. Repeat it to name "
            "several; omit it for every state.",
        ),
    ] = None,
    qualification_statuses: Annotated[
        list[QualificationStatus] | None,
        Query(
            alias="qualification_status",
            description="Only Applications the Screening verdict decided one of these ways. "
            "Repeat it to name several; omit it for every verdict.",
        ),
    ] = None,
    job_id: Annotated[
        UUID | None, Query(description="Only Applications for this Job of the tenant.")
    ] = None,
    received_within: Annotated[
        ReceivedWithin | None,
        Query(
            description="Only Applications received inside this rolling window. Omit it for "
            "every Application the tenant has ever had."
        ),
    ] = None,
    sort: Annotated[
        ApplicationSort,
        Query(description="Which end of `applied_at` the list starts at."),
    ] = ApplicationSort.NEWEST,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the first page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> TenantApplicationPage:
    """Every Application the tenant has received, across every Job. Page with `next_cursor`,
    keeping `sort`.

    Each row names the Job it came in for — the Job's own triage list can leave that implied,
    and a list spanning all of them cannot. `job_id` narrows this list rather than looking a Job
    up, so another tenant's Job matches nothing here instead of refusing.

    `status_counts` and `verdict_counts` come back whatever the two filters narrow to, so the
    caller can say how many Applications each one is keeping off the list.
    """
    return await applications.tenant_page(
        recruiter,
        statuses=application_statuses,
        qualification_statuses=qualification_statuses,
        job_id=job_id,
        received_within=received_within,
        sort=sort,
        cursor=cursor,
        limit=limit,
    )


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
        422: openapi_problem(
            "A `hired` move carries no `start_date`, or another status carries one."
        ),
    },
)
async def change_application_status(
    application_id: UUID,
    body: ApplicationStatusChange,
    recruiter: ActingRecruiterDep,
    applications: ApplicationReviewServiceDep,
) -> MovedApplication:
    """Move it anywhere the pipeline allows, backwards included.

    The candidate reads a Stage rather than these statuses, so only a move that changes that
    Stage reaches them — `candidate_notified` says whether this one did. Moving between
    `reviewing`, `shortlisted`, `interview` and `offer` is silent by design.

    A rejection also queues the one email a human decision earns. A `hired` move records what
    the tenant says happened and the day it started, and asks the candidate to confirm it: until
    they do, it is a claim rather than a Placement. The Screening verdict is untouched, whatever
    the Application's status becomes.
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


@router.delete(
    "/{application_id}/assessments/{assessment_id}",
    operation_id="deleteApplicationMatchAssessment",
    summary="Throw away one AI match assessment",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**TENANT_ACCESS_REFUSED, **ASSESSMENT_NOT_FOUND},
)
async def delete_application_match_assessment(
    application_id: UUID,
    assessment_id: UUID,
    recruiter: ActingRecruiterDep,
    assessments: MatchAssessmentServiceDep,
) -> Response:
    """One reading and no other: the rest of the history keeps the model that wrote each of them.

    Any recruiter of the Tenant may throw one away, and asking again writes a new one rather than
    bringing this one back.
    """
    await assessments.remove(recruiter, application_id, assessment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{application_id}/messages",
    operation_id="messageApplicant",
    summary="Email the applicant from a Message template",
    status_code=status.HTTP_201_CREATED,
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem(
            "This tenant has no application, or no message template, with that id."
        ),
    },
)
async def message_applicant(
    application_id: UUID,
    body: OutgoingMessage,
    recruiter: ActingRecruiterDep,
    outreach: OutreachServiceDep,
) -> QueuedMessage:
    """Placeholders resolve against this Application, and the response is the exact words queued.

    Each send is its own decision: the same template twice is two messages. A send may carry its
    own wording in place of the template's, which changes nothing about the saved template. The
    Candidate's verified address is the sender's to resolve, not this request's.
    """
    return await outreach.send(recruiter, application_id, body)


@router.post(
    "/{application_id}/notes",
    operation_id="writeApplicationNote",
    summary="Write a note on an Application",
    status_code=status.HTTP_201_CREATED,
    responses={**TENANT_ACCESS_REFUSED, **APPLICATION_NOT_FOUND},
)
async def write_application_note(
    application_id: UUID,
    body: NewNote,
    recruiter: ActingRecruiterDep,
    notes: ApplicationNotesDep,
) -> Note:
    """Private to the Tenant, and stamped with the recruiter who wrote it."""
    return await notes.write(recruiter, application_id, body)


@router.get(
    "/{application_id}/notes",
    operation_id="listApplicationNotes",
    summary="The notes on one Application, newest first",
    responses={
        **TENANT_ACCESS_REFUSED,
        **APPLICATION_NOT_FOUND,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_application_notes(
    application_id: UUID,
    recruiter: ActingRecruiterDep,
    notes: ApplicationNotesDep,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> NotePage:
    """Everything this Tenant's recruiters have written here. No other tenant's notes."""
    return await notes.page(recruiter, application_id, cursor=cursor, limit=limit)


@router.patch(
    "/{application_id}/notes/{note_id}",
    operation_id="editApplicationNote",
    summary="Rewrite a note on an Application",
    responses={**TENANT_ACCESS_REFUSED, **NOTE_NOT_FOUND},
)
async def edit_application_note(
    application_id: UUID,
    note_id: UUID,
    body: NoteChanges,
    recruiter: ActingRecruiterDep,
    notes: ApplicationNotesDep,
) -> Note:
    """Notes belong to the Tenant, so any of its recruiters may rewrite one — the author it
    records stays the recruiter who first wrote it."""
    return await notes.edit(recruiter, application_id, note_id, body)


@router.delete(
    "/{application_id}/notes/{note_id}",
    operation_id="deleteApplicationNote",
    summary="Delete a note from an Application",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**TENANT_ACCESS_REFUSED, **NOTE_NOT_FOUND},
)
async def delete_application_note(
    application_id: UUID,
    note_id: UUID,
    recruiter: ActingRecruiterDep,
    notes: ApplicationNotesDep,
) -> Response:
    """Any recruiter of the Tenant may delete any of its notes."""
    await notes.remove(recruiter, application_id, note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{application_id}/tags",
    operation_id="listApplicationTags",
    summary="The Tags on one Application",
    responses={**TENANT_ACCESS_REFUSED, **APPLICATION_NOT_FOUND},
)
async def list_application_tags(
    application_id: UUID, recruiter: ActingRecruiterDep, tags: ApplicationTagsDep
) -> list[Tag]:
    """The Tenant's own filing of this Application, by name. No other tenant's Tags are here."""
    return await tags.tags(recruiter, application_id)


@router.put(
    "/{application_id}/tags/{tag_id}",
    operation_id="tagApplication",
    summary="Put one of the Tenant's Tags on an Application",
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem("This tenant has no application or no tag with that id."),
        409: openapi_problem("That Tag is candidate-scoped and cannot go on an Application."),
    },
)
async def tag_application(
    application_id: UUID, tag_id: UUID, recruiter: ActingRecruiterDep, tags: ApplicationTagsDep
) -> Tag:
    """Idempotent: putting a Tag on twice leaves it on once, and answers with the Tag."""
    return await tags.put_on(recruiter, application_id, tag_id)


@router.delete(
    "/{application_id}/tags/{tag_id}",
    operation_id="untagApplication",
    summary="Take a Tag off an Application",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem("This tenant has no application or no tag with that id."),
    },
)
async def untag_application(
    application_id: UUID, tag_id: UUID, recruiter: ActingRecruiterDep, tags: ApplicationTagsDep
) -> Response:
    """Idempotent: a Tag that was never on it is not an error."""
    await tags.take_off(recruiter, application_id, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
