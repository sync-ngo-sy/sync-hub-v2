from __future__ import annotations

from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import TYPE_CHECKING

from sqlalchemy import select, update

from sync_core import ObjectNotFoundError, StorageError, get_logger, transaction
from sync_core.models import (
    Candidate,
    CanonicalRole,
    Cv,
    CvParsingStatus,
    Language,
    SkillTaxonomy,
)
from sync_core.notifications import CvParseFailed, notify
from sync_core.storage import cv_media_type_of
from sync_ingestion.review import Vocabularies, reviewable
from sync_parsers import (
    PARSED_CV_SCHEMA_VERSION,
    CvFile,
    ExtractionError,
    UnreadableCvError,
    Vocabulary,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Database, Storage
    from sync_parsers import CvExtractor, ParsedCv

logger = get_logger(__name__)


class CvUnparseableError(Exception):
    pass


class IngestionUnavailableError(Exception):
    pass


class CvIngestion:
    def __init__(self, database: Database, storage: Storage, extractor: CvExtractor) -> None:
        self._database = database
        self._storage = storage
        self._extractor = extractor

    async def begin(self, cv_id: UUID) -> None:
        async with self._database.session() as session, transaction(session):
            await session.execute(
                update(Cv)
                .where(Cv.id == cv_id)
                .values(parsing_status=CvParsingStatus.PROCESSING, parsing_error=None)
            )

    async def parse(self, cv_id: UUID) -> ParsedCv:
        async with self._database.session() as session:
            cv = await session.get(Cv, cv_id)
            if cv is None:
                raise CvUnparseableError(f"cv {cv_id} no longer exists")
            storage_path = cv.storage_path
            filename, media_type = _describe(cv.display_name, storage_path)
            vocabulary, known = await _vocabulary(session)

        content = await self._fetch(filename, cv_id, storage_path=storage_path)
        try:
            parsed = await self._extractor.extract(
                CvFile(filename=filename, media_type=media_type, content=content),
                vocabulary,
            )
        except UnreadableCvError as refused:
            raise CvUnparseableError(str(refused)) from refused
        except ExtractionError as unavailable:
            raise IngestionUnavailableError(str(unavailable)) from unavailable

        return reviewable(parsed, known)

    async def store(self, session: AsyncSession, cv_id: UUID, parsed: ParsedCv) -> None:
        await session.execute(
            update(Cv)
            .where(Cv.id == cv_id)
            .values(
                parsed_cv_data=parsed.model_dump(mode="json"),
                parsed_cv_schema_version=PARSED_CV_SCHEMA_VERSION,
                detected_language=parsed.detected_language,
                parsed_at=datetime.now(UTC),
                parsing_status=CvParsingStatus.READY,
                parsing_error=None,
            )
        )
        await self._adopt_as_current(session, cv_id)

    async def fail(self, session: AsyncSession, cv_id: UUID, reason: str) -> None:
        cv = (
            await session.execute(
                select(Cv.candidate_id, Cv.display_name, Cv.deleted_at).where(Cv.id == cv_id)
            )
        ).one_or_none()
        if cv is None:
            logger.warning("cv_ingestion.failed_cv_gone", cv_id=str(cv_id), reason=reason)
            return

        await session.execute(
            update(Cv)
            .where(Cv.id == cv_id)
            .values(parsing_status=CvParsingStatus.FAILED, parsing_error=reason)
        )
        if cv.deleted_at is None:
            await notify(
                session,
                cv.candidate_id,
                CvParseFailed(cv_id=cv_id, display_name=cv.display_name),
            )
        logger.warning(
            "cv_ingestion.failed",
            cv_id=str(cv_id),
            reason=reason,
            deleted=cv.deleted_at is not None,
        )

    async def _adopt_as_current(self, session: AsyncSession, cv_id: UUID) -> None:
        candidate_id = await session.scalar(select(Cv.candidate_id).where(Cv.id == cv_id))
        if candidate_id is None:  # pragma: no cover — `parse` has already read this row
            return
        candidate = await session.get(Candidate, candidate_id, with_for_update=True)
        if candidate is None or candidate.current_cv_id is not None:
            return
        # Read under that lock, which deleting a CV takes too: a CV deleted while it was being
        # read is not adopted, and the parse just paid for is not rolled back by the trigger
        # that would refuse a deleted CV as the current one.
        if await session.scalar(select(Cv.deleted_at).where(Cv.id == cv_id)) is not None:
            return
        candidate.current_cv_id = cv_id
        logger.info("cv_ingestion.adopted_as_current", candidate_id=str(candidate_id))

    async def _fetch(self, filename: str, cv_id: UUID, *, storage_path: str) -> bytes:
        try:
            return await self._storage.download(storage_path)
        except ObjectNotFoundError as missing:
            logger.error("cv_ingestion.file_missing", cv_id=str(cv_id), path=storage_path)
            raise CvUnparseableError(f"the stored file for {filename} is gone") from missing
        except StorageError as unavailable:
            raise IngestionUnavailableError("Storage could not be read") from unavailable


def _describe(display_name: str, storage_path: str) -> tuple[str, str]:
    media_type = cv_media_type_of(storage_path)
    extension = PurePosixPath(storage_path).suffix.lower()
    stem = PurePosixPath(display_name).name or "cv"
    filename = stem if stem.lower().endswith(extension) else f"{stem}{extension}"
    return filename, media_type


async def _vocabulary(session: AsyncSession) -> tuple[Vocabulary, Vocabularies]:
    skills = list(await session.scalars(select(SkillTaxonomy.canonical_name)))
    roles = list(await session.scalars(select(CanonicalRole.key)))
    codes = list(await session.scalars(select(Language.code)))
    return (
        Vocabulary(canonical_skills=skills, canonical_roles=roles, language_codes=codes),
        Vocabularies(
            taxonomy={name.lower(): name for name in skills},
            roles={key.lower(): key for key in roles},
            languages={code.lower(): code for code in codes},
        ),
    )
