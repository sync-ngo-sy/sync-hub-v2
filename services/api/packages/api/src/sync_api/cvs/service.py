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


async def signed_download(storage: Storage, settings: Settings, cv: CvRow) -> CvDownloadLink:
    """A short-lived link to the original file, for whoever is entitled to read it."""
    expires_in = settings.cv_download_url_ttl_seconds
    try:
        url = await storage.signed_url(cv.storage_path, expires_in=expires_in)
    except ObjectNotFoundError as missing:
        logger.error("cvs.file_missing", cv_id=str(cv.id), path=cv.storage_path)
        raise Problem(
            status=502,
            type=CV_FILE_UNAVAILABLE_PROBLEM_TYPE,
            detail="The stored file for this CV could not be reached.",
        ) from missing
    return CvDownloadLink(url=url, expires_in_seconds=expires_in)


class CvService:
    def __init__(self, session: AsyncSession, storage: Storage, settings: Settings) -> None:
        self._db = session
        self._storage = storage
        self._settings = settings

    async def upload(self, candidate_id: UUID, upload: UploadFile) -> Cv:
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
                await self._discard(storage_path)
                raise

        logger.info(
            "cvs.uploaded", candidate_id=str(candidate_id), cv_id=str(cv_id), bytes=file.size
        )
        return await self._as_payload(candidate_id, row)

    async def cv(self, candidate_id: UUID, cv_id: UUID) -> Cv:
        return await self._as_payload(candidate_id, await self._own_cv(candidate_id, cv_id))

    async def download_link(self, candidate_id: UUID, cv_id: UUID) -> CvDownloadLink:
        cv = await self._own_cv(candidate_id, cv_id)
        return await signed_download(self._storage, self._settings, cv)

    async def _refuse_duplicate(self, candidate_id: UUID, file_hash: str) -> None:
        existing = await self._active_cv_with(candidate_id, file_hash)
        if existing is not None:
            raise _duplicate(existing)

    async def _active_cv_with(self, candidate_id: UUID, file_hash: str) -> UUID | None:
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
        winner = await self._active_cv_with(candidate_id, file_hash)
        if winner is None:  # pragma: no cover — some other constraint, which is our bug
            return Problem(status=500, detail="The CV could not be saved.")
        return _duplicate(winner)

    async def _discard(self, storage_path: str) -> None:
        try:
            await self._storage.remove(storage_path)
        except StorageError as error:
            logger.error("cvs.orphaned_object", path=storage_path, error=str(error))

    async def _own_cv(self, candidate_id: UUID, cv_id: UUID) -> CvRow:
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
    if cv.parsed_cv_data is None:
        return None
    try:
        return ParsedCv.model_validate(cv.parsed_cv_data)
    except ValueError:
        logger.error("cvs.unreadable_parse", cv_id=str(cv.id))
        return None


def _duplicate(existing: UUID) -> Problem:
    return Problem(
        status=409,
        type=DUPLICATE_CV_PROBLEM_TYPE,
        detail="You have already uploaded this file.",
        cv_id=str(existing),
    )
