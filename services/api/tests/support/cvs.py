"""Uploading CVs the way the SPA uploads them, and looking at what that left behind.

The upload helpers go through the real multipart endpoint — there is no way to conjure a
`cvs` row here, because the row, the object in Storage and the trigger-enqueued parse job
are the thing under test and arranging any of them by hand would arrange away the point.

The readers below do go straight to Postgres and Storage. `ingestion_jobs` is deliberately
invisible to clients (`database-contracts.md`: plumbing readers ignore), and whether the
uploaded bytes actually reached the bucket is not something the API will ever say.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID, uuid4

from sqlalchemy import select, text

from sync_core.models import Cv, IngestionJob

if TYPE_CHECKING:
    import asyncpg
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Storage

CVS: Final = "/v1/candidates/me/cvs"
PDF: Final = "application/pdf"
DOCX: Final = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

#: A real, readable CV, for the `ai_live` tests that send one to an actual model. The main
#: suite parses with the fake extractor and never looks at a byte of what it uploaded.
FIXTURES: Final = Path(__file__).resolve().parents[1] / "fixtures" / "cvs"
A_REAL_CV: Final = FIXTURES / "amina-haddad.pdf"


def some_bytes(marker: str = "") -> bytes:
    """A file that is distinct from every other one a test uploads.

    Distinct because the duplicate rule is keyed on the SHA-256 of the content: two
    uploads meant to be two CVs have to actually differ, and two meant to be the same file
    have to be byte-identical.
    """
    return b"%PDF-1.4\n% " + (marker or uuid4().hex).encode() + b"\n%%EOF\n"


async def upload_cv(
    browser: AsyncClient,
    content: bytes | None = None,
    *,
    filename: str = "cv.pdf",
    media_type: str | None = PDF,
) -> Response:
    """Post a CV the way a browser posts one — multipart, one `file` part."""
    return await browser.post(
        CVS,
        files={"file": (filename, content if content is not None else some_bytes(), media_type)},
    )


async def an_uploaded_cv(browser: AsyncClient, content: bytes | None = None) -> dict[str, Any]:
    """One accepted upload, as the API described it."""
    response = await upload_cv(browser, content)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def cv_row(session: AsyncSession, cv_id: UUID | str) -> Cv:
    """The `cvs` row, re-read. Expired first: the worker writes it on another connection."""
    session.expire_all()
    cv = await session.get(Cv, UUID(str(cv_id)))
    assert cv is not None, f"no cvs row for {cv_id}"
    return cv


async def ingestion_job(session: AsyncSession, cv_id: UUID | str) -> IngestionJob:
    """The parse job the `cvs` insert trigger enqueued."""
    session.expire_all()
    job = await session.scalar(select(IngestionJob).where(IngestionJob.cv_id == UUID(str(cv_id))))
    assert job is not None, f"no ingestion_jobs row for {cv_id}"
    return job


async def stored_bytes(storage: Storage, session: AsyncSession, cv_id: UUID | str) -> bytes:
    """What actually reached the bucket, fetched back out of it."""
    cv = await cv_row(session, cv_id)
    return await storage.download(cv.storage_path)


async def empty_cv_bucket(connection: asyncpg.Connection, storage: Storage) -> None:
    """Delete every object in the `cvs` bucket, before its rows are truncated away.

    Order matters and is the whole reason this exists. Storage lists and deletes objects
    through `storage.objects`, so truncating that table first would leave the files behind
    with nothing able to name them — the local stack's disk would fill up with CVs from
    every test run that ever happened.
    """
    stored = await connection.fetch("select name from storage.objects where bucket_id = 'cvs'")
    for row in stored:
        await storage.remove(row["name"])


async def cv_object_count(session: AsyncSession) -> int:
    """How many files the `cvs` bucket is holding.

    The way to ask whether a refused upload left an object behind: no route lists them,
    and an orphan is invisible everywhere else.
    """
    count = await session.scalar(
        text("select count(*) from storage.objects where bucket_id = 'cvs'")
    )
    return int(count or 0)
