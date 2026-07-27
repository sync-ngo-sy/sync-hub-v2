"""Uploading a CV, watching it being read, and getting the original file back.

`/me` throughout, for the reason `routes/candidates.py` gives: a CV is nobody else's, and
a candidate id in the path would be an id to try substituting. The CV's own id *is* in the
path — a candidate has several — and every route scopes its lookup by the session's
candidate, so another candidate's id is a 404 rather than a document.
"""

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

#: What every route here can answer with when the id in the path is not one of the
#: caller's CVs — whether because it is somebody else's or because it is nothing at all.
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
    """Store the file and start reading it.

    Answers as soon as the CV exists, not when it has been parsed — the reading happens in
    the worker and takes about ten seconds. The response comes back `uploaded`; poll the
    CV until it is `ready` or `failed`.

    The same file twice is a 409 rather than a second CV, and the 409 carries the id of the
    CV already holding it.
    """
    return await cvs.upload(candidate.id, file)


@router.get(
    "/{cv_id}",
    operation_id="getMyCv",
    summary="A CV and how far its parse has got",
    responses={**CANDIDATE_ACCESS_REFUSED, **CV_NOT_FOUND},
)
async def get_my_cv(cv_id: UUID, cvs: CvServiceDep, candidate: ActingCandidateDep) -> Cv:
    """What to poll while a CV is being read.

    `parsing_status` is the authoritative state: `uploaded` and `processing` mean keep
    waiting, `ready` means `parsed_cv` is filled in, and `failed` means it never will be
    and `parsing_error` says why.
    """
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
    """Where to fetch the file the candidate uploaded.

    A fresh link each time, good for a few minutes. Ask for one when the candidate clicks;
    storing one is storing a key to the document.
    """
    return await cvs.download_link(candidate.id, cv_id)
