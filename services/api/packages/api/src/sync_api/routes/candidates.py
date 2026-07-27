from __future__ import annotations

from typing import Any, Final

from fastapi import APIRouter

from sync_api.candidates import CandidateProfile
from sync_api.dependencies import ActingCandidateDep, CandidateProfileServiceDep
from sync_api.errors import openapi_problem
from sync_api.problems import ValidationProblemDetail

ROUTER_PREFIX: Final = "/candidates"

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
    """Everything the profile form renders, and a valid body to `PUT` back."""
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
    """Replace the profile whole — an omitted section is an emptied one — and answer with it."""
    return await profiles.replace(candidate.id, body)
