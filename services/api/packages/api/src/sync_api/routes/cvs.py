from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from sync_api.candidates import ProfileDraft
from sync_api.cvs import MAX_ACTIVE_CVS, Cv, CvDownloadLink
from sync_api.dependencies import ActingCandidateDep, CvServiceDep
from sync_api.errors import openapi_problem
from sync_api.problems import CvConflictProblemDetail
from sync_api.rate_limit import enforce_cv_upload_rate_limit
from sync_api.routes.candidates import CANDIDATE_ACCESS_REFUSED

ROUTER_PREFIX: Final = "/candidates/me/cvs"

CV_NOT_FOUND: Final[dict[int | str, dict[str, Any]]] = {
    404: openapi_problem("The caller has no CV with that id."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["cvs"])


@router.post(
    "",
    status_code=201,
    operation_id="uploadMyCv",
    summary="Upload a CV",
    dependencies=[Depends(enforce_cv_upload_rate_limit)],
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        409: openapi_problem(
            "This exact file is already one of the caller's CVs, and `cv_id` is the one it is; "
            f"or the caller already keeps {MAX_ACTIVE_CVS} CVs.",
            CvConflictProblemDetail,
        ),
        413: openapi_problem("The file is larger than the platform accepts."),
        415: openapi_problem("The file is not a PDF, DOC or DOCX."),
        429: openapi_problem(
            "The caller has uploaded too many CVs, this minute or today. `Retry-After` says how "
            "long to wait."
        ),
        502: openapi_problem("The file store could not be reached."),
    },
)
async def upload_my_cv(
    cvs: CvServiceDep,
    candidate: ActingCandidateDep,
    file: Annotated[UploadFile, File(description="The CV: PDF, DOC or DOCX, up to 10 MB.")],
) -> Cv:
    """Store the file and start parsing it. Poll the CV until `ready` or `failed`."""
    return await cvs.upload(candidate.id, file)


@router.get(
    "",
    operation_id="listMyCvs",
    summary="Every CV the caller keeps",
    responses=CANDIDATE_ACCESS_REFUSED,
)
async def list_my_cvs(cvs: CvServiceDep, candidate: ActingCandidateDep) -> list[Cv]:
    """Newest first — a candidate keeps few enough that they do not page. Deleted CVs are not
    among them."""
    return await cvs.cvs(candidate.id)


@router.get(
    "/{cv_id}",
    operation_id="getMyCv",
    summary="A CV and how far its parse has got",
    responses={**CANDIDATE_ACCESS_REFUSED, **CV_NOT_FOUND},
)
async def get_my_cv(cv_id: UUID, cvs: CvServiceDep, candidate: ActingCandidateDep) -> Cv:
    """What to poll while a CV is parsed. `parsing_status` is the authoritative state."""
    return await cvs.cv(candidate.id, cv_id)


@router.get(
    "/{cv_id}/profile-draft",
    operation_id="getMyProfileDraftFromCv",
    summary="What this CV says the caller's profile could be",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        **CV_NOT_FOUND,
        409: openapi_problem("The CV has not been read yet, so there is nothing to fill from."),
    },
)
async def get_my_profile_draft_from_cv(
    cv_id: UUID, cvs: CvServiceDep, candidate: ActingCandidateDep
) -> ProfileDraft:
    """Computed and saved nowhere: review it, edit it, then `PUT` it to
    `/candidates/me/profile`, which replaces. Skills already on the profile come back with the
    years the candidate typed; skills only this CV names come back with none.
    """
    return await cvs.profile_draft(candidate.id, cv_id)


@router.post(
    "/{cv_id}/make-current",
    operation_id="makeMyCvCurrent",
    summary="Apply and be found with this CV from now on",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        **CV_NOT_FOUND,
        409: openapi_problem("The CV has not been read yet, so it cannot be the current one."),
    },
)
async def make_my_cv_current(cv_id: UUID, cvs: CvServiceDep, candidate: ActingCandidateDep) -> Cv:
    """Only a `ready` CV can be current. Applications already submitted keep the CV they named."""
    return await cvs.make_current(candidate.id, cv_id)


@router.delete(
    "/{cv_id}",
    operation_id="deleteMyCv",
    summary="Delete a CV",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        **CV_NOT_FOUND,
        409: openapi_problem("The CV is the current one; make another current first."),
    },
)
async def delete_my_cv(cv_id: UUID, cvs: CvServiceDep, candidate: ActingCandidateDep) -> Response:
    """Frees a slot, and the file to be uploaded again. Whoever is reviewing an Application made
    with it still sees it."""
    await cvs.remove(candidate.id, cv_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{cv_id}/download",
    operation_id="getMyCvDownloadLink",
    summary="A short-lived link to the original file",
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        **CV_NOT_FOUND,
        502: openapi_problem("The stored file could not be reached."),
    },
)
async def get_my_cv_download_link(
    cv_id: UUID, cvs: CvServiceDep, candidate: ActingCandidateDep
) -> CvDownloadLink:
    """A short-lived link to the uploaded file. Ask for a fresh one per click; never store it."""
    return await cvs.download_link(candidate.id, cv_id)
