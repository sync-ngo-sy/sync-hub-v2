from __future__ import annotations

from typing import Annotated, Any, Final

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from pydantic import BaseModel, Field

from sync_api.avatars import Avatar
from sync_api.candidates import (
    CandidateProfile,
    ExperienceTotal,
    ExperienceTotalRequest,
    derived_experience,
)
from sync_api.dependencies import (
    ActingCandidateDep,
    AvatarServiceDep,
    CandidateDeletionDep,
    CandidateProfileServiceDep,
    SessionCookiesDep,
)
from sync_api.errors import openapi_problem
from sync_api.pictures import ACCEPTED_FORMATS
from sync_api.problems import ValidationProblemDetail
from sync_api.rate_limit import enforce_account_deletion_rate_limit

ROUTER_PREFIX: Final = "/candidates"

CANDIDATE_ACCESS_REFUSED: Final[dict[int | str, dict[str, Any]]] = {
    401: openapi_problem("There is no valid session."),
    403: openapi_problem("The caller is not a candidate."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["candidates"])


class DeleteAccountRequest(BaseModel):
    password: Annotated[
        str,
        Field(
            min_length=1,
            max_length=72,
            description="The caller's current password, confirming the deletion.",
        ),
    ]


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


@router.post(
    "/me/profile/experience-total",
    operation_id="calculateMyExperienceTotal",
    summary="Calculate total experience without saving",
    responses=CANDIDATE_ACCESS_REFUSED,
)
async def calculate_my_experience_total(
    body: ExperienceTotalRequest, _: ActingCandidateDep
) -> ExperienceTotal:
    return ExperienceTotal(total_experience_years=derived_experience(body.experiences))


@router.put(
    "/me/avatar",
    operation_id="replaceMyAvatar",
    summary="Set the caller's profile photo",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        413: openapi_problem("The file is larger than the platform accepts."),
        415: openapi_problem(f"The file is not a {ACCEPTED_FORMATS} image."),
        422: openapi_problem("The file is empty."),
        502: openapi_problem("The file store could not be reached."),
    },
)
async def replace_my_avatar(
    candidate: ActingCandidateDep,
    avatars: AvatarServiceDep,
    file: Annotated[
        UploadFile,
        File(description=f"The photo: {ACCEPTED_FORMATS}. Square or it is cropped."),
    ],
) -> Avatar:
    """The photo everywhere the candidate appears. Sent square by the portal's crop; anything
    else keeps its middle square. What comes back is stored small, so send the original.

    Replaces whatever photo the candidate had, at a new URL — the old one stops answering.
    """
    return await avatars.replace(candidate.id, file)


@router.post(
    "/me/deletion",
    operation_id="deleteMyAccount",
    summary="Delete the caller's account",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(enforce_account_deletion_rate_limit)],
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        401: openapi_problem("There is no valid session, or the password is wrong."),
    },
)
async def delete_my_account(
    body: DeleteAccountRequest,
    candidate: ActingCandidateDep,
    deletion: CandidateDeletionDep,
    cookies: SessionCookiesDep,
) -> Response:
    """Scrub the profile, purge the discovery artifacts and ban the login. Applications stay.

    Irreversible, and confirmed with the caller's password. The Applications a Tenant already
    received — their Snapshots and the CV files behind them — go on being readable to that Tenant.
    """
    await deletion.delete(candidate.id, email=candidate.profile.email, password=body.password)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    cookies.clear(response)
    return response
