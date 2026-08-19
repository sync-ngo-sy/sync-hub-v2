from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Query
from pydantic import BeforeValidator

from sync_api.candidate_directory.filters import CandidateFiltersDep
from sync_api.dependencies import ActingRecruiterDep, CandidateSearchServiceDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.problems import ValidationProblemDetail
from sync_api.search import CandidateMatches
from sync_api.text import without_control_characters
from sync_core.profile import MAX_LINE_LENGTH
from sync_rag import MAX_SEARCH_DEPTH

ROUTER_PREFIX: Final = "/search"

SEARCH_ACCESS_REFUSED: Final[dict[int | str, dict[str, Any]]] = {
    401: openapi_problem("There is no valid session."),
    403: openapi_problem("The caller is not a recruiter of an active tenant."),
    503: openapi_problem("Global search is not configured on this deployment."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["search"])


@router.get(
    "/candidates",
    operation_id="searchCandidates",
    summary="Find Searchable Candidates across tenants, closest match first",
    responses={
        **SEARCH_ACCESS_REFUSED,
        422: openapi_problem(
            "A filter names a Location, a Canonical role, a language or a Canonical skill the "
            "platform does not have. The refusal names the offending one.",
            ValidationProblemDetail,
        ),
    },
)
async def search_candidates(
    recruiter: ActingRecruiterDep,
    search: CandidateSearchServiceDep,
    filters: CandidateFiltersDep,
    q: Annotated[
        str,
        Query(
            min_length=2,
            max_length=MAX_LINE_LENGTH,
            description="What you are looking for, in your own words.",
            examples=["backend engineer who has run payment systems"],
        ),
        BeforeValidator(without_control_characters),
    ],
    keywords: Annotated[
        str | None,
        Query(
            max_length=MAX_LINE_LENGTH,
            description="Words that must appear somewhere in the profile — a skill, a job "
            'description, a qualification. Supports `"quoted phrases"`, `or` and `-excluded`.',
        ),
        BeforeValidator(without_control_characters),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")] = (
        DEFAULT_PAGE_SIZE
    ),
    offset: Annotated[
        int,
        Query(
            ge=0,
            lt=MAX_SEARCH_DEPTH,
            description=f"How many of the ranking to skip. One search reaches at most "
            f"{MAX_SEARCH_DEPTH} Candidates, and a page that would cross that is cut short.",
        ),
    ] = 0,
) -> CandidateMatches:
    """Candidates ranked by what `q` means, each with the profile fragment that matched.

    Every filter is a hard one — a Candidate that fails any of them is not a result, and none of
    them changes the order. Results never carry an email or a phone number: read one Candidate to
    get either.

    The ranking is paged by `offset` rather than by a cursor, because a cursor on closeness would
    have to re-enter the index traversal it came out of. `depth_reached` says there are more
    matches that this search will not reach, so ask a narrower question rather than paging on.
    """
    return await search.matches(
        recruiter, q, filters=filters, keywords=keywords, limit=limit, offset=offset
    )
