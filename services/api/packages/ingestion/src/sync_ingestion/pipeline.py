"""Reading one CV, from the row the upload left to the parse the candidate reviews.

Split into the four steps the worker engine needs, rather than one `parse_cv()`, because
where the transactions go matters more here than anywhere else in the platform: the middle
step takes about ten seconds and costs money, and the last one has to be committed with the
queue row so it cannot happen twice.

- `begin` — one short write, so a candidate polling sees `processing` rather than a status
  that sits at `uploaded` for ten seconds and looks stuck.
- `parse` — download, model, review. No transaction, and no writes.
- `store` / `fail` — the outcome, in a transaction the engine owns and commits with the job.

`cvs.parsing_status` is the authoritative state (`database-contracts.md`); `ingestion_jobs`
is plumbing the SPA never sees. So the CV's status is written last on the way to `ready`,
and — this is the part worth guarding — `failed` is written *only* when the job is dead for
good. A CV that flickered to `failed` between two retries would tell a candidate their
upload was rejected while the platform was still perfectly well trying.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import TYPE_CHECKING

from sqlalchemy import select, update

from sync_core import ObjectNotFoundError, StorageError, get_logger
from sync_core.models import Candidate, Cv, CvParsingStatus, Language, SkillTaxonomy
from sync_core.storage import CV_MEDIA_TYPE_BY_EXTENSION, DEFAULT_CV_MEDIA_TYPE
from sync_ingestion.review import reviewable
from sync_parsers import (
    PARSED_CV_SCHEMA_VERSION,
    CvDocument,
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
    """This CV will not parse, however many times it is tried."""


class IngestionUnavailableError(Exception):
    """Something the parse depends on was not available. Worth another attempt."""


class CvIngestion:
    """The CV pipeline: one instance per worker process, one call per step."""

    def __init__(self, database: Database, storage: Storage, extractor: CvExtractor) -> None:
        self._database = database
        self._storage = storage
        self._extractor = extractor

    async def begin(self, cv_id: UUID) -> None:
        """Say out loud that this CV is being worked on."""
        async with self._database.session() as session:
            await session.execute(
                update(Cv)
                .where(Cv.id == cv_id)
                .values(parsing_status=CvParsingStatus.PROCESSING, parsing_error=None)
            )
            await session.commit()

    async def parse(self, cv_id: UUID) -> ParsedCv:
        """Read the CV: fetch the file, send it to the model, and check what comes back.

        Every failure leaves as one of this module's two exceptions, so the caller decides
        whether to retry on what happened rather than on which library raised.
        """
        async with self._database.session() as session:
            cv = await session.get(Cv, cv_id)
            if cv is None:
                # The row is gone, so `ON DELETE CASCADE` has taken the job with it and
                # this is a claim that raced a deletion. Nothing to parse, ever.
                raise CvUnparseableError(f"cv {cv_id} no longer exists")
            storage_path = cv.storage_path
            filename, media_type = _document(cv.display_name, storage_path)
            vocabulary, taxonomy, languages = await _vocabulary(session)

        content = await self._fetch(filename, cv_id, storage_path=storage_path)
        try:
            parsed = await self._extractor.extract(
                CvDocument(filename=filename, media_type=media_type, content=content),
                vocabulary,
            )
        except UnreadableCvError as refused:
            raise CvUnparseableError(str(refused)) from refused
        except ExtractionError as unavailable:
            raise IngestionUnavailableError(str(unavailable)) from unavailable

        return reviewable(parsed, taxonomy=taxonomy, languages=languages)

    async def store(self, session: AsyncSession, cv_id: UUID, parsed: ParsedCv) -> None:
        """Record the parse and make the CV `ready` — the last write of a successful parse.

        Not committed here: the engine commits this together with the queue row, so a
        `ready` CV always has a finished job behind it and is never parsed a second time.
        """
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
        """Mark the CV failed. Only ever called for a job that will not be retried."""
        await session.execute(
            update(Cv)
            .where(Cv.id == cv_id)
            .values(parsing_status=CvParsingStatus.FAILED, parsing_error=reason)
        )
        logger.warning("cv_ingestion.failed", cv_id=str(cv_id), reason=reason)

    async def _adopt_as_current(self, session: AsyncSession, cv_id: UUID) -> None:
        """A candidate's first ready CV becomes the one they apply and are found with.

        Only the first: after that, which CV is current is the candidate's choice, and
        silently switching it on every upload would move their search presence to whichever
        document they last happened to try.

        The candidate row is locked because two CVs finishing at once would otherwise both
        find `current_cv_id` empty and both set it — the second overwriting a choice the
        first had already made.
        """
        candidate_id = await session.scalar(select(Cv.candidate_id).where(Cv.id == cv_id))
        if candidate_id is None:  # pragma: no cover — `parse` has already read this row
            return
        candidate = await session.get(Candidate, candidate_id, with_for_update=True)
        if candidate is None or candidate.current_cv_id is not None:
            return
        candidate.current_cv_id = cv_id
        logger.info("cv_ingestion.adopted_as_current", candidate_id=str(candidate_id))

    async def _fetch(self, filename: str, cv_id: UUID, *, storage_path: str) -> bytes:
        try:
            return await self._storage.download(storage_path)
        except ObjectNotFoundError as missing:
            # The row outlived its object. Retrying cannot conjure the file back.
            logger.error("cv_ingestion.file_missing", cv_id=str(cv_id), path=storage_path)
            raise CvUnparseableError(f"the stored file for {filename} is gone") from missing
        except StorageError as unavailable:
            raise IngestionUnavailableError("Storage could not be read") from unavailable


def _document(display_name: str, storage_path: str) -> tuple[str, str]:
    """What to call the file and what to say it is, for the model.

    The extension comes from `storage_path` rather than from `display_name`, because the
    path is ours — the API built it from the media type it accepted — while the display
    name is whatever the candidate's file happened to be called. The provider reads the
    extension, so a `.docx` a candidate named "resume" has to reach it as `resume.docx`.
    """
    extension = PurePosixPath(storage_path).suffix.lower()
    media_type = CV_MEDIA_TYPE_BY_EXTENSION.get(extension, DEFAULT_CV_MEDIA_TYPE)
    stem = PurePosixPath(display_name).name or "cv"
    filename = stem if stem.lower().endswith(extension) else f"{stem}{extension}"
    return filename, media_type


async def _vocabulary(session: AsyncSession) -> tuple[Vocabulary, dict[str, str], dict[str, str]]:
    """The platform's own words: for the prompt, and for checking the answer against.

    Read per parse rather than cached, so a Canonical skill an operator adds is mappable on
    the next CV rather than after the next deploy.
    """
    skills = list(await session.scalars(select(SkillTaxonomy.canonical_name)))
    codes = list(await session.scalars(select(Language.code)))
    return (
        Vocabulary(canonical_skills=skills, language_codes=codes),
        {name.lower(): name for name in skills},
        {code.lower(): code for code in codes},
    )
