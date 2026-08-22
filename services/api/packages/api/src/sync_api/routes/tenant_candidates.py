from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from sync_api.applications import CandidatePlacement
from sync_api.crm import NewNote, Note, NoteChanges, NotePage, Tag
from sync_api.dependencies import (
    ActingRecruiterDep,
    CandidateNotesDep,
    CandidatePlacementsDep,
    CandidateTagsDep,
)
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/tenants/me/candidates"

CANDIDATE_OUT_OF_REACH: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem(
        "No Candidate this tenant can reach has that id — they have neither applied to one of "
        "its Jobs nor opted in to Global search."
    ),
}

NOTE_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem(
        "This tenant can reach no candidate, or wrote no such note, with that id."
    ),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["candidates"])


@router.post(
    "/{candidate_id}/notes",
    operation_id="writeCandidateNote",
    summary="Write a note about a Candidate",
    status_code=status.HTTP_201_CREATED,
    responses={**TENANT_ACCESS_REFUSED, **CANDIDATE_OUT_OF_REACH},
)
async def write_candidate_note(
    candidate_id: UUID,
    body: NewNote,
    recruiter: ActingRecruiterDep,
    notes: CandidateNotesDep,
) -> Note:
    """About the person rather than one Application of theirs, and private to the Tenant."""
    return await notes.write(recruiter, candidate_id, body)


@router.get(
    "/{candidate_id}/notes",
    operation_id="listCandidateNotes",
    summary="The notes about one Candidate, newest first",
    responses={
        **TENANT_ACCESS_REFUSED,
        **CANDIDATE_OUT_OF_REACH,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_candidate_notes(
    candidate_id: UUID,
    recruiter: ActingRecruiterDep,
    notes: CandidateNotesDep,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> NotePage:
    """Everything this Tenant's recruiters have written about them. No other tenant's notes."""
    return await notes.page(recruiter, candidate_id, cursor=cursor, limit=limit)


@router.patch(
    "/{candidate_id}/notes/{note_id}",
    operation_id="editCandidateNote",
    summary="Rewrite a note about a Candidate",
    responses={**TENANT_ACCESS_REFUSED, **NOTE_NOT_FOUND},
)
async def edit_candidate_note(
    candidate_id: UUID,
    note_id: UUID,
    body: NoteChanges,
    recruiter: ActingRecruiterDep,
    notes: CandidateNotesDep,
) -> Note:
    """Notes belong to the Tenant, so any of its recruiters may rewrite one — the author it
    records stays the recruiter who first wrote it."""
    return await notes.edit(recruiter, candidate_id, note_id, body)


@router.delete(
    "/{candidate_id}/notes/{note_id}",
    operation_id="deleteCandidateNote",
    summary="Delete a note about a Candidate",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**TENANT_ACCESS_REFUSED, **NOTE_NOT_FOUND},
)
async def delete_candidate_note(
    candidate_id: UUID,
    note_id: UUID,
    recruiter: ActingRecruiterDep,
    notes: CandidateNotesDep,
) -> Response:
    """Any recruiter of the Tenant may delete any of its notes."""
    await notes.remove(recruiter, candidate_id, note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{candidate_id}/tags",
    operation_id="listCandidateTags",
    summary="The Tags on one Candidate",
    responses={**TENANT_ACCESS_REFUSED, **CANDIDATE_OUT_OF_REACH},
)
async def list_candidate_tags(
    candidate_id: UUID, recruiter: ActingRecruiterDep, tags: CandidateTagsDep
) -> list[Tag]:
    """The Tenant's own filing of this Candidate, by name. No other tenant's Tags are here."""
    return await tags.tags(recruiter, candidate_id)


@router.put(
    "/{candidate_id}/tags/{tag_id}",
    operation_id="tagCandidate",
    summary="Put one of the Tenant's Tags on a Candidate",
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem("This tenant can reach no candidate, or has no tag, with that id."),
        409: openapi_problem("That Tag is application-scoped and cannot go on a Candidate."),
    },
)
async def tag_candidate(
    candidate_id: UUID, tag_id: UUID, recruiter: ActingRecruiterDep, tags: CandidateTagsDep
) -> Tag:
    """Idempotent: putting a Tag on twice leaves it on once, and answers with the Tag."""
    return await tags.put_on(recruiter, candidate_id, tag_id)


@router.delete(
    "/{candidate_id}/tags/{tag_id}",
    operation_id="untagCandidate",
    summary="Take a Tag off a Candidate",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem("This tenant can reach no candidate, or has no tag, with that id."),
    },
)
async def untag_candidate(
    candidate_id: UUID, tag_id: UUID, recruiter: ActingRecruiterDep, tags: CandidateTagsDep
) -> Response:
    """Idempotent: a Tag that was never on them is not an error."""
    await tags.take_off(recruiter, candidate_id, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{candidate_id}/placements",
    operation_id="listCandidatePlacements",
    summary="The Placements this Tenant has made of one Candidate",
    responses={**TENANT_ACCESS_REFUSED, **CANDIDATE_OUT_OF_REACH},
)
async def list_candidate_placements(
    candidate_id: UUID, recruiter: ActingRecruiterDep, placements: CandidatePlacementsDep
) -> list[CandidatePlacement]:
    """A Placement is a hire this Candidate confirmed, and this list is read from the view that
    says so — nothing that is not one can appear here, and neither can another Tenant's.

    A list rather than one fact: this Tenant may have placed the same person more than once.
    Newest start first, and empty for a Candidate it has placed nobody of.
    """
    return await placements.of_candidate(recruiter, candidate_id)
