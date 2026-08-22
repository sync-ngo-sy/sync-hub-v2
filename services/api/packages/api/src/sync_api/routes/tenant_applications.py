from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from sync_api.applications import (
    ApplicationReview,
    ApplicationSort,
    ApplicationStatusChange,
    MatchAssessment,
    MovedApplication,
    ReceivedWithin,
    SweptApplications,
    TenantApplicationPage,
    TenantApplicationSweep,
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
from sync_api.problems import ValidationProblemDetail
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
        Query(description="Whether the list runs on `applied_at` or on the Match score."),
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


@router.post(
    "/sweep",
    operation_id="sweepTenantApplications",
    summary="Move every Application the Tenant is reading that stands in the statuses named",
    tags=["applications"],
    responses={
        **TENANT_ACCESS_REFUSED,
        422: openapi_problem(
            "`statuses` names a status that has already ended or names none at all, or `to` is "
            "somewhere a set cannot be sent.",
            ValidationProblemDetail,
        ),
    },
)
async def sweep_tenant_applications(
    body: TenantApplicationSweep,
    recruiter: ActingRecruiterDep,
    applications: ApplicationReviewServiceDep,
) -> SweptApplications:
    """Take one act across every Job the Tenant is hiring for, in one transaction.

    The request carries the Reading rather than the Applications, so a sweep of fifty thousand is
    the same request as a sweep of twelve and there is no selection too large to send. `statuses`
    is what the Pipeline tab would have narrowed to, `qualification_statuses` is the Screening
    filter and `received_within` the Received window, both carried over so the sweep acts on the
    list the Recruiter was reading. The counts to choose against are the `status_counts` the list
    already returns, which are totals for the whole Reading rather than for the page loaded.

    `to` says where they all go. A rung of the ladder is silent: `reviewing`, `shortlisted`,
    `interview` and `offer` are one Stage to the Candidate, so only a row leaving `new` crosses a
    boundary and gets the Notification saying so. `rejected` is the rejection a single move makes,
    held to the same Telling — three days out and shared by the whole set. `hired` is refused,
    because a hire names the day it started and one act over many Applications cannot answer
    that, and so is `new`, which is where an Application arrives rather than somewhere a set is
    sent.
    """
    return await applications.sweep_tenant(recruiter, body)


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

    A rejection is decided now and told three days later, at the `told_at` this returns: until
    then the candidate's Stage still reads in review, their bell is silent, and the one email a
    human decision earns waits in the queue. Taking it back to `reviewing` inside those three
    days cancels all three, so `candidate_notified` is false for both moves. Reopening after
    `told_at` has passed is allowed too, and is equally silent — the candidate has read the
    rejection, and no message says it has been undone.

    A `hired` move records what the tenant says happened and the day it started, and asks the
    candidate to confirm it: until they do, it is a claim rather than a Placement. The Screening
    verdict is untouched, whatever the Application's status becomes.
    """
    return await applications.move(recruiter, application_id, body)


@router.post(
    "/{application_id}/assessment",
    operation_id="assessApplicationMatch",
    summary="Ask an AI to read the Application against the Job again",
    dependencies=[Depends(enforce_assessment_rate_limit)],
    responses={
        **TENANT_ACCESS_REFUSED,
        **APPLICATION_NOT_FOUND,
        429: openapi_problem(
            "The tenant has asked for too many assessments. `Retry-After` says how long to wait."
        ),
        502: openapi_problem("The model could not read it. The reading it had is untouched."),
        503: openapi_problem("This deployment has no assessment model configured."),
    },
)
async def assess_application_match(
    application_id: UUID,
    recruiter: ActingRecruiterDep,
    assessments: MatchAssessmentServiceDep,
) -> MatchAssessment:
    """A percentage and an explanation, drawn from the Snapshot and the Job's criteria.

    Every Application is read once as it arrives; this is how a Recruiter who distrusts that
    reading gets a better one. It replaces the reading in place and answers with what it just
    read, so the Match score a Job's list sorts by moves with it.

    Advice, and only that: it never touches the Screening verdict, and it reads what the
    candidate froze when they applied rather than their profile as it stands today.
    """
    return await assessments.assess(recruiter, application_id)


@router.get(
    "/{application_id}/assessment",
    operation_id="readApplicationMatchAssessment",
    summary="The AI's reading of the Application",
    responses={**TENANT_ACCESS_REFUSED, **APPLICATION_NOT_FOUND},
)
async def read_application_match_assessment(
    application_id: UUID,
    recruiter: ActingRecruiterDep,
    assessments: MatchAssessmentServiceDep,
) -> MatchAssessment | None:
    """The one reading the Application carries, with the model and prompt version that wrote it.

    Null where no model has managed one yet — the reading is enqueued as the Application
    arrives, so this is either a few seconds early or a provider that stayed down.
    """
    return await assessments.current(recruiter, application_id)


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
