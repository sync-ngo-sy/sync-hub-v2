from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Query

from sync_api.dependencies import ActingRecruiterDep, CandidateDirectoryServiceDep
from sync_api.discovery import CandidateDirectoryPage, CandidateRecord
from sync_api.discovery.filters import CandidateFiltersDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.problems import ValidationProblemDetail
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/directory"

UNKNOWN_FILTER: Final[dict[int | str, dict[str, Any]]] = {
    422: openapi_problem(
        "A filter names a Location, a Canonical role, a language or a Canonical skill the "
        "platform does not have. The refusal names the offending one.",
        ValidationProblemDetail,
    ),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["directory"])


@router.get(
    "/candidates",
    operation_id="listDirectoryCandidates",
    summary="Searchable Candidates by fact, newest first",
    responses={**TENANT_ACCESS_REFUSED, **UNKNOWN_FILTER},
)
async def list_directory_candidates(
    recruiter: ActingRecruiterDep,
    directory: CandidateDirectoryServiceDep,
    filters: CandidateFiltersDep,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> CandidateDirectoryPage:
    """Everyone in Damascus, everyone with React and TypeScript, everyone with five years of work.

    No query written in words: every filter is a yes or a no, so naming more of them only ever
    narrows the answer, and the whole result can be paged to the end.

    A Candidate whose re-embedding is still queued is here even though Global search cannot see
    them yet — being findable by fact does not wait on a vector. No result carries an email or a
    phone number.
    """
    return await directory.page(recruiter, filters=filters, cursor=cursor, limit=limit)


@router.get(
    "/candidates/{candidate_id}",
    operation_id="readDirectoryCandidate",
    summary="One Candidate's whole profile, with their contact details",
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem(
            "No Candidate this tenant can reach has that id — they have neither applied to one "
            "of its Jobs nor opted in to Global search."
        ),
    },
)
async def read_directory_candidate(
    candidate_id: UUID,
    recruiter: ActingRecruiterDep,
    directory: CandidateDirectoryServiceDep,
) -> CandidateRecord:
    """Skills, work history, education, languages and projects, read directly rather than found.

    The one place a phone number and an email address are readable, one Candidate at a time. A
    Candidate outside this Tenant's reach answers exactly as one that does not exist.
    """
    return await directory.record(recruiter, candidate_id)
