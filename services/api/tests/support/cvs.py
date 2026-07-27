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

FIXTURES: Final = Path(__file__).resolve().parents[1] / "fixtures" / "cvs"
A_REAL_PDF_CV: Final = FIXTURES / "amina-haddad.pdf"
A_REAL_DOCX_CV: Final = FIXTURES / "bashir-nassar.docx"


def some_bytes(marker: str = "") -> bytes:
    return b"%PDF-1.4\n% " + (marker or uuid4().hex).encode() + b"\n%%EOF\n"


async def upload_cv(
    browser: AsyncClient,
    content: bytes | None = None,
    *,
    filename: str = "cv.pdf",
    media_type: str | None = PDF,
) -> Response:
    return await browser.post(
        CVS,
        files={"file": (filename, content if content is not None else some_bytes(), media_type)},
    )


async def an_uploaded_cv(browser: AsyncClient, content: bytes | None = None) -> dict[str, Any]:
    response = await upload_cv(browser, content)
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def cv_row(session: AsyncSession, cv_id: UUID | str) -> Cv:
    session.expire_all()
    cv = await session.get(Cv, UUID(str(cv_id)))
    assert cv is not None, f"no cvs row for {cv_id}"
    return cv


async def ingestion_job(session: AsyncSession, cv_id: UUID | str) -> IngestionJob:
    session.expire_all()
    job = await session.scalar(select(IngestionJob).where(IngestionJob.cv_id == UUID(str(cv_id))))
    assert job is not None, f"no ingestion_jobs row for {cv_id}"
    return job


async def stored_bytes(storage: Storage, session: AsyncSession, cv_id: UUID | str) -> bytes:
    cv = await cv_row(session, cv_id)
    return await storage.download(cv.storage_path)


async def empty_cv_bucket(connection: asyncpg.Connection, storage: Storage) -> None:
    stored = await connection.fetch("select name from storage.objects where bucket_id = 'cvs'")
    for row in stored:
        await storage.remove(row["name"])


async def cv_object_count(session: AsyncSession) -> int:
    count = await session.scalar(
        text("select count(*) from storage.objects where bucket_id = 'cvs'")
    )
    return int(count or 0)
