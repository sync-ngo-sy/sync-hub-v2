from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from sync_api.candidate_directory import CandidateDirectoryPage, CandidateRecord, DirectoryOrder
from sync_api.candidate_directory.filters import CandidateFiltersDep
from sync_api.dependencies import ActingRecruiterDep, CandidateDirectoryServiceDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.problems import ValidationProblemDetail
from sync_api.rate_limit import (
    enforce_candidate_record_rate_limit,
    enforce_directory_rate_limit,
)
from sync_api.routes.tenants import TENANT_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/directory"

UNKNOWN_FILTER: Final[dict[int | str, dict[str, Any]]] = {
    422: openapi_problem(
        "A filter names a Location, a Canonical role, a language or a Canonical skill the "
        "platform does not have. The refusal names the offending one.",
        ValidationProblemDetail,
    ),
}

PAGED_TOO_HARD: Final[dict[int | str, dict[str, Any]]] = {
    429: openapi_problem(
        "The tenant has paged the directory too hard, this minute or today. `Retry-After` says "
        "how long to wait."
    ),
}

READ_TOO_MANY: Final[dict[int | str, dict[str, Any]]] = {
    429: openapi_problem(
        "The tenant has read too many Candidates' contact details, this minute or today. "
        "`Retry-After` says how long to wait."
    ),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["directory"])


@router.get(
    "/candidates",
    operation_id="listDirectoryCandidates",
    summary="Searchable Candidates by fact, in the order you ask for",
    dependencies=[Depends(enforce_directory_rate_limit)],
    responses={**TENANT_ACCESS_REFUSED, **UNKNOWN_FILTER, **PAGED_TOO_HARD},
)
async def list_directory_candidates(
    recruiter: ActingRecruiterDep,
    directory: CandidateDirectoryServiceDep,
    filters: CandidateFiltersDep,
    sort: Annotated[
        DirectoryOrder,
        Query(
            description="What order to answer in. Newest first unless you say otherwise, and a "
            "`cursor` only ever resumes the order it was issued for."
        ),
    ] = DirectoryOrder.NEWEST,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the first page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> CandidateDirectoryPage:
    """Everyone in Damascus, everyone with React and TypeScript, everyone with five years of work.

    No query written in words: every filter is a yes or a no, so naming more of them only ever
    narrows the answer, and the whole result can be paged to the end. Because nothing here is
    ranked, the order is the caller's to choose — which is what separates this from Global search,
    where closeness is the order and re-sorting it would be a different question.

    A Candidate whose re-embedding is still queued is here even though Global search cannot see
    them yet — being findable by fact does not wait on a vector. No result carries an email or a
    phone number.
    """
    return await directory.page(recruiter, filters=filters, order=sort, cursor=cursor, limit=limit)


@router.get(
    "/candidates/{candidate_id}",
    operation_id="readDirectoryCandidate",
    summary="One Candidate's whole profile, with their contact details",
    dependencies=[Depends(enforce_candidate_record_rate_limit)],
    responses={
        **TENANT_ACCESS_REFUSED,
        404: openapi_problem(
            "No Candidate this tenant can reach has that id — they have neither applied to one "
            "of its Jobs nor opted in to Global search."
        ),
        **READ_TOO_MANY,
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

    Carries the tightest budget of the discovery routes for that reason, and every read is
    logged.
    """
    return await directory.record(recruiter, candidate_id)
