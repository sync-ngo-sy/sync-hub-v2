from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, File, UploadFile

from sync_api.cvs import Cv, CvDownloadLink
from sync_api.dependencies import ActingCandidateDep, CvServiceDep
from sync_api.errors import openapi_problem
from sync_api.problems import DuplicateCvProblemDetail
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
    responses={
        **CANDIDATE_ACCESS_REFUSED,
        409: openapi_problem(
            "This exact file is already one of the caller's CVs; `cv_id` is the one it is.",
            DuplicateCvProblemDetail,
        ),
        413: openapi_problem("The file is larger than the platform accepts."),
        415: openapi_problem("The file is not a PDF, DOC or DOCX."),
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
    "/{cv_id}",
    operation_id="getMyCv",
    summary="A CV and how far its parse has got",
    responses={**CANDIDATE_ACCESS_REFUSED, **CV_NOT_FOUND},
)
async def get_my_cv(cv_id: UUID, cvs: CvServiceDep, candidate: ActingCandidateDep) -> Cv:
    """What to poll while a CV is parsed. `parsing_status` is the authoritative state."""
    return await cvs.cv(candidate.id, cv_id)


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
