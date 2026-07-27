from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Query

from sync_api.dependencies import ActingRecruiterDep, CandidateSearchServiceDep
from sync_api.errors import openapi_problem
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sync_api.search import CandidateMatches
from sync_core.profile import MAX_LINE_LENGTH

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
    summary="Find Searchable Candidates across tenants",
    responses=SEARCH_ACCESS_REFUSED,
)
async def search_candidates(
    recruiter: ActingRecruiterDep,
    search: CandidateSearchServiceDep,
    q: Annotated[
        str,
        Query(
            min_length=2,
            max_length=MAX_LINE_LENGTH,
            description="What you are looking for, in your own words.",
            examples=["backend engineer who has run payment systems"],
        ),
    ],
    location: Annotated[
        str | None,
        Query(max_length=MAX_LINE_LENGTH, description="Matched inside the candidate's location."),
    ] = None,
    language: Annotated[
        str | None, Query(max_length=8, description="A candidate's preferred language code.")
    ] = None,
    keywords: Annotated[
        str | None,
        Query(
            max_length=MAX_LINE_LENGTH,
            description='Words that must appear in the profile. Supports `"quoted phrases"`, '
            "`or` and `-excluded`.",
        ),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")] = (
        DEFAULT_PAGE_SIZE
    ),
) -> CandidateMatches:
    """Candidates ranked by what `q` means, each with the profile fragment that matched.

    Every filter is a hard one — a candidate that fails any of them is not a result, and
    `keywords` never changes the order. Results never carry an email or a phone number.
    """
    return await search.matches(
        q, location=location, language_code=language, keywords=keywords, limit=limit
    )
