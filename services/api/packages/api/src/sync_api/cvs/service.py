"""What a Candidate does with their CVs.

Three operations, and the first is the interesting one. An upload has to leave three
things behind together — the object in Storage, the `cvs` row, and the parse job the row's
trigger enqueues — or leave nothing behind at all. Two of them are in Postgres and commit
together; the third is on another service and cannot join that transaction. So the object
is written first and *removed again* if the row does not land, which is the only ordering
where a failure leaves a candidate with no half-uploaded CV in their list.

The duplicate check is asked twice on purpose. Once before the upload, so the common case —
a candidate pressing the button again — costs nothing; and once as the partial unique index
`cvs_candidate_file_hash_active_uidx`, which is what actually decides it when two uploads
race. The pre-check is an optimization; the index is the rule.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from sync_api.cvs.payload import Cv, CvDownloadLink
from sync_api.cvs.upload import received
from sync_api.problems import (
    CV_FILE_UNAVAILABLE_PROBLEM_TYPE,
    CV_NOT_FOUND_PROBLEM_TYPE,
    DUPLICATE_CV_PROBLEM_TYPE,
    Problem,
)
from sync_core import ObjectNotFoundError, StorageError, get_logger, transaction
from sync_core.models import Candidate
from sync_core.models import Cv as CvRow
from sync_core.storage import cv_object_path
from sync_parsers import ParsedCv

if TYPE_CHECKING:
    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings, Storage

logger = get_logger(__name__)


class CvService:
    """One request's worth of CV work."""

    def __init__(self, session: AsyncSession, storage: Storage, settings: Settings) -> None:
        self._db = session
        self._storage = storage
        self._settings = settings

    async def upload(self, candidate_id: UUID, upload: UploadFile) -> Cv:
        """Store a CV, record it, and let the trigger queue it for parsing.

        The `cvs` insert is the whole transaction: `enqueue_cv_ingestion` fires on it, so
        the parse job is committed with the row that needs parsing and no CV can end up
        sitting in `uploaded` with nothing coming for it.
        """
        async with received(upload, max_bytes=self._settings.cv_max_upload_bytes) as file:
            await self._refuse_duplicate(candidate_id, file.sha256)

            cv_id = uuid4()
            storage_path = cv_object_path(candidate_id, cv_id, file.media_type)
            await self._storage.upload(storage_path, file.reader, media_type=file.media_type)
            try:
                row = await self._insert(
                    cv_id,
                    candidate_id=candidate_id,
                    display_name=file.display_name,
                    storage_path=storage_path,
                    file_hash=file.sha256,
                )
            except BaseException:
                # Including the 409 a racing duplicate raises: the loser of that race has
                # already written an object nothing will ever point at.
                await self._discard(storage_path)
                raise

        logger.info(
            "cvs.uploaded", candidate_id=str(candidate_id), cv_id=str(cv_id), bytes=file.size
        )
        return await self._as_payload(candidate_id, row)

    async def cv(self, candidate_id: UUID, cv_id: UUID) -> Cv:
        """One CV and how far its parse has got — what the SPA polls while it waits."""
        return await self._as_payload(candidate_id, await self._own_cv(candidate_id, cv_id))

    async def download_link(self, candidate_id: UUID, cv_id: UUID) -> CvDownloadLink:
        """A short-lived URL for the original file.

        Ownership is checked here, on the row, before Storage is asked for anything —
        which is what makes the signed URL an owner's link rather than an open one. The
        object's own path is unguessable, but a path nobody can guess is not access
        control.
        """
        cv = await self._own_cv(candidate_id, cv_id)
        expires_in = self._settings.cv_download_url_ttl_seconds
        try:
            url = await self._storage.signed_url(cv.storage_path, expires_in=expires_in)
        except ObjectNotFoundError as missing:
            # The row promises a file that is not there. Nothing a candidate can do about
            # it, and nothing they should be told beyond "not now".
            logger.error("cvs.file_missing", cv_id=str(cv_id), path=cv.storage_path)
            raise Problem(
                status=502,
                type=CV_FILE_UNAVAILABLE_PROBLEM_TYPE,
                detail="The stored file for this CV could not be reached.",
            ) from missing
        return CvDownloadLink(url=url, expires_in_seconds=expires_in)

    async def _refuse_duplicate(self, candidate_id: UUID, file_hash: str) -> None:
        existing = await self._active_cv_with(candidate_id, file_hash)
        if existing is not None:
            raise _duplicate(existing)

    async def _active_cv_with(self, candidate_id: UUID, file_hash: str) -> UUID | None:
        """The CV this candidate already has of this exact file, if any.

        Exactly the condition `cvs_candidate_file_hash_active_uidx` indexes — asked here
        before an upload to save one, and again afterwards when the index refuses one.
        """
        existing: UUID | None = await self._db.scalar(
            select(CvRow.id).where(
                CvRow.candidate_id == candidate_id,
                CvRow.file_hash == file_hash,
                CvRow.deleted_at.is_(None),
            )
        )
        return existing

    async def _insert(
        self,
        cv_id: UUID,
        *,
        candidate_id: UUID,
        display_name: str,
        storage_path: str,
        file_hash: str,
    ) -> CvRow:
        row = CvRow(
            id=cv_id,
            candidate_id=candidate_id,
            display_name=display_name,
            storage_path=storage_path,
            file_hash=file_hash,
        )
        self._db.add(row)
        try:
            async with transaction(self._db):
                await self._db.flush()
        except IntegrityError as clash:
            raise await self._duplicate_that_won(candidate_id, file_hash) from clash
        await self._db.refresh(row)
        return row

    async def _duplicate_that_won(self, candidate_id: UUID, file_hash: str) -> Problem:
        """The 409 for an upload that lost the race to the unique index.

        Re-read rather than assumed: the index is the only thing that knows which of two
        simultaneous uploads of the same file became the CV, and the answer a client needs
        is that one's id.
        """
        winner = await self._active_cv_with(candidate_id, file_hash)
        if winner is None:  # pragma: no cover — some other constraint, which is our bug
            return Problem(status=500, detail="The CV could not be saved.")
        return _duplicate(winner)

    async def _discard(self, storage_path: str) -> None:
        """Undo an upload whose row did not land. Never the reason a request fails."""
        try:
            await self._storage.remove(storage_path)
        except StorageError as error:
            logger.error("cvs.orphaned_object", path=storage_path, error=str(error))

    async def _own_cv(self, candidate_id: UUID, cv_id: UUID) -> CvRow:
        """This candidate's CV, or a 404 that says nothing about whose it is.

        Scoped by `candidate_id` rather than checked afterwards: somebody else's CV and a
        CV that does not exist have to be the same answer, or the 404 becomes a way to ask
        whether an id is real.
        """
        cv = await self._db.scalar(
            select(CvRow).where(
                CvRow.id == cv_id,
                CvRow.candidate_id == candidate_id,
                CvRow.deleted_at.is_(None),
            )
        )
        if cv is None:
            raise Problem(
                status=404,
                type=CV_NOT_FOUND_PROBLEM_TYPE,
                detail="No CV of yours has that id.",
            )
        return cv

    async def _as_payload(self, candidate_id: UUID, cv: CvRow) -> Cv:
        candidate = await self._db.get(Candidate, candidate_id)
        return Cv(
            id=cv.id,
            display_name=cv.display_name,
            parsing_status=cv.parsing_status,
            parsing_error=cv.parsing_error,
            detected_language=cv.detected_language,
            is_current=candidate is not None and candidate.current_cv_id == cv.id,
            created_at=cv.created_at,
            parsed_at=cv.parsed_at,
            parsed_cv=_parsed(cv),
        )


def _parsed(cv: CvRow) -> ParsedCv | None:
    """The stored parse, re-validated on the way out.

    It was written by this application against this schema, so a row that no longer fits
    means the schema moved without its data — worth a log line and a null rather than a
    500 on a polling request the SPA makes every second.
    """
    if cv.parsed_cv_data is None:
        return None
    try:
        return ParsedCv.model_validate(cv.parsed_cv_data)
    except ValueError:
        logger.error("cvs.unreadable_parse", cv_id=str(cv.id))
        return None


def _duplicate(existing: UUID) -> Problem:
    """The 409 a re-upload gets, carrying the CV the candidate already has.

    The id is the point: the SPA can go straight to that CV rather than making the
    candidate work out which of their uploads this was.
    """
    return Problem(
        status=409,
        type=DUPLICATE_CV_PROBLEM_TYPE,
        detail="You have already uploaded this file.",
        cv_id=str(existing),
    )
