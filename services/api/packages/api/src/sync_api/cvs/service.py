from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final
from uuid import UUID, uuid4

from sqlalchemy import ColumnElement, and_, func, select, update
from sqlalchemy.exc import IntegrityError

from sync_api.candidates import ProfileDraft, draft_of, stated_skills, whole_candidate
from sync_api.cvs.payload import Cv, CvDownloadLink
from sync_api.cvs.upload import received
from sync_api.problems import (
    CV_FILE_UNAVAILABLE_PROBLEM_TYPE,
    CV_IS_CURRENT_PROBLEM_TYPE,
    CV_LIMIT_REACHED_PROBLEM_TYPE,
    CV_NOT_FOUND_PROBLEM_TYPE,
    CV_NOT_READY_PROBLEM_TYPE,
    DUPLICATE_CV_PROBLEM_TYPE,
    Problem,
)
from sync_core import ObjectNotFoundError, StorageError, get_logger, transaction
from sync_core.models import Candidate, CvParsingStatus
from sync_core.models import Cv as CvRow
from sync_core.storage import cv_object_path
from sync_parsers import ParsedCv

if TYPE_CHECKING:
    from fastapi import UploadFile
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings, Storage

logger = get_logger(__name__)

#: How many CVs a candidate may keep at once. A CV they have deleted no longer counts.
MAX_ACTIVE_CVS: Final = 5


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
            await self._refuse_over_the_cap(candidate_id)

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

    async def cvs(self, candidate_id: UUID) -> list[Cv]:
        rows = await self._db.scalars(
            select(CvRow)
            .where(_active_cvs_of(candidate_id))
            .order_by(CvRow.created_at.desc(), CvRow.id.desc())
        )
        current = await self._current_cv_id(candidate_id)
        return [_payload(row, current=current) for row in rows]

    async def cv(self, candidate_id: UUID, cv_id: UUID) -> Cv:
        return await self._as_payload(candidate_id, await self._own_cv(candidate_id, cv_id))

    async def profile_draft(self, candidate_id: UUID, cv_id: UUID) -> ProfileDraft:
        """What this CV says the profile could be. Nothing is written: the candidate reviews it
        and `PUT`s it back, which is the only way a profile ever gets populated."""
        cv = await self._own_cv(candidate_id, cv_id)
        if cv.parsing_status is not CvParsingStatus.READY:
            raise Problem(
                status=409,
                type=CV_NOT_READY_PROBLEM_TYPE,
                detail="This CV has not been read yet, so there is nothing to fill a profile "
                "from. Wait for it to be processed.",
            )
        parsed = _parsed(cv)
        if parsed is None:  # pragma: no cover — `ready` is written after the parse is stored
            raise LookupError(f"cv {cv.id} is ready with no readable parse")
        candidate, identity = await whole_candidate(self._db, candidate_id)
        return draft_of(
            parsed,
            candidate=candidate,
            full_name=identity.full_name,
            skills=await stated_skills(self._db, candidate_id),
        )

    async def make_current(self, candidate_id: UUID, cv_id: UUID) -> Cv:
        """The CV the candidate applies and is found with, once the platform has read it."""
        async with transaction(self._db):
            await self._lock(candidate_id)
            cv = await self._own_cv(candidate_id, cv_id)
            if cv.parsing_status is not CvParsingStatus.READY:
                raise Problem(
                    status=409,
                    type=CV_NOT_READY_PROBLEM_TYPE,
                    detail="This CV has not been read yet, so it cannot be the current one. "
                    "Wait for it to be processed, or pick one that already has been.",
                )
            # Guarded, so making the current CV current again is not a profile change: any
            # update of the candidate row enqueues a re-embedding of their whole profile.
            await self._db.execute(
                update(Candidate)
                .where(
                    Candidate.id == candidate_id,
                    Candidate.current_cv_id.is_distinct_from(cv_id),
                )
                .values(current_cv_id=cv_id)
            )

        logger.info("cvs.made_current", candidate_id=str(candidate_id), cv_id=str(cv_id))
        return await self._as_payload(candidate_id, cv)

    async def remove(self, candidate_id: UUID, cv_id: UUID) -> None:
        """Soft: the Applications a Tenant already reviews go on naming this CV and its file."""
        async with transaction(self._db):
            await self._lock(candidate_id)
            cv = await self._own_cv(candidate_id, cv_id)
            if await self._current_cv_id(candidate_id) == cv_id:
                raise Problem(
                    status=409,
                    type=CV_IS_CURRENT_PROBLEM_TYPE,
                    detail="This is your current CV. Make another CV current first, then "
                    "delete this one.",
                )
            cv.deleted_at = datetime.now(UTC)

        logger.info("cvs.deleted", candidate_id=str(candidate_id), cv_id=str(cv_id))

    async def download_link(self, candidate_id: UUID, cv_id: UUID) -> CvDownloadLink:
        cv = await self._own_cv(candidate_id, cv_id)
        return await signed_download(self._storage, self._settings, cv)

    async def _refuse_duplicate(self, candidate_id: UUID, file_hash: str) -> None:
        existing = await self._active_cv_with(candidate_id, file_hash)
        if existing is not None:
            raise _duplicate(existing)

    async def _refuse_over_the_cap(self, candidate_id: UUID) -> None:
        if await self._active_cv_count(candidate_id) >= MAX_ACTIVE_CVS:
            raise Problem(
                status=409,
                type=CV_LIMIT_REACHED_PROBLEM_TYPE,
                detail=f"You can keep {MAX_ACTIVE_CVS} CVs at a time. Delete one you no "
                "longer need first.",
            )

    async def _active_cv_count(self, candidate_id: UUID) -> int:
        count = await self._db.scalar(
            select(func.count()).select_from(CvRow).where(_active_cvs_of(candidate_id))
        )
        return int(count or 0)

    async def _active_cv_with(self, candidate_id: UUID, file_hash: str) -> UUID | None:
        existing: UUID | None = await self._db.scalar(
            select(CvRow.id).where(_active_cvs_of(candidate_id), CvRow.file_hash == file_hash)
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
        try:
            async with transaction(self._db):
                # Counted again here: the check before the upload cannot see an insert that
                # lands while the file is being written.
                await self._lock(candidate_id)
                await self._refuse_over_the_cap(candidate_id)
                self._db.add(row)
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
            select(CvRow).where(_active_cvs_of(candidate_id), CvRow.id == cv_id)
        )
        if cv is None:
            raise Problem(
                status=404,
                type=CV_NOT_FOUND_PROBLEM_TYPE,
                detail="No CV of yours has that id.",
            )
        return cv

    async def _lock(self, candidate_id: UUID) -> None:
        """The candidate row is what counting CVs, switching the current one and deleting one
        all queue on, so no two of them can decide on the same stale answer."""
        await self._db.execute(
            select(Candidate.id).where(Candidate.id == candidate_id).with_for_update()
        )

    async def _current_cv_id(self, candidate_id: UUID) -> UUID | None:
        current: UUID | None = await self._db.scalar(
            select(Candidate.current_cv_id).where(Candidate.id == candidate_id)
        )
        return current

    async def _as_payload(self, candidate_id: UUID, cv: CvRow) -> Cv:
        return _payload(cv, current=await self._current_cv_id(candidate_id))


def _active_cvs_of(candidate_id: UUID) -> ColumnElement[bool]:
    """One candidate's CVs, the deleted ones excluded — what every read of their own asks for."""
    return and_(CvRow.candidate_id == candidate_id, CvRow.deleted_at.is_(None))


def _payload(cv: CvRow, *, current: UUID | None) -> Cv:
    return Cv(
        id=cv.id,
        display_name=cv.display_name,
        parsing_status=cv.parsing_status,
        parsing_error=cv.parsing_error,
        detected_language=cv.detected_language,
        is_current=cv.id == current,
        created_at=cv.created_at,
        parsed_at=cv.parsed_at,
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
