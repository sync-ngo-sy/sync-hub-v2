"""What a Candidate does to their own record.

`/me` throughout, and for a stronger reason than the tenant routes have: a Candidate's data
is nobody else's, so a candidate id in the path would be an id to try substituting for
somebody else's. There is no such path. The session says who this is.
"""

from __future__ import annotations

from typing import Any, Final

from fastapi import APIRouter

from sync_api.candidates import CandidateProfile
from sync_api.dependencies import ActingCandidateDep, CandidateProfileServiceDep
from sync_api.errors import openapi_problem
from sync_api.problems import ValidationProblemDetail

ROUTER_PREFIX: Final = "/candidates"

#: What any candidate-scoped route can answer with when it will not answer at all.
CANDIDATE_ACCESS_REFUSED: Final[dict[int | str, dict[str, Any]]] = {
    401: openapi_problem("There is no valid session."),
    403: openapi_problem("The caller is not a candidate."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["candidates"])


@router.get(
    "/me/profile",
    operation_id="getMyProfile",
    summary="The caller's whole professional profile",
    responses=CANDIDATE_ACCESS_REFUSED,
)
async def get_my_profile(
    candidate: ActingCandidateDep, profiles: CandidateProfileServiceDep
) -> CandidateProfile:
    """Everything the profile form renders, in one payload — and a valid body to `PUT` back.

    Every section is present even when empty: the form is the same form either way.
    """
    return await profiles.profile(candidate.id)


@router.put(
    "/me/profile",
    operation_id="replaceMyProfile",
    summary="Replace the caller's whole professional profile",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        422: openapi_problem(
            "A skill is not a Canonical skill, or a language code is not one the platform "
            "knows. Both name the offending entries.",
            ValidationProblemDetail,
        ),
        409: openapi_problem("Opting in to Global search needs a current CV."),
    },
)
async def replace_my_profile(
    body: CandidateProfile,
    candidate: ActingCandidateDep,
    profiles: CandidateProfileServiceDep,
) -> CandidateProfile:
    """Save the profile whole, and answer with what was stored.

    A replacement, not a patch: a section the body leaves out is a section the candidate
    has emptied. The save is one transaction, so it either all happened or none of it did.
    """
    return await profiles.replace(candidate.id, body)
