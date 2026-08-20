from __future__ import annotations

import asyncio
import hashlib
from typing import Final

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.dependencies import get_storage
from sync_core import Settings, Storage
from sync_core.models import CvParsingStatus, IngestionStatus
from tests.support.candidates import a_signed_in_candidate
from tests.support.cvs import (
    A_REAL_DOCX_CV,
    A_REAL_PDF_CV,
    CVS,
    DOCX,
    PDF,
    an_uploaded_cv,
    cv_object_count,
    cv_row,
    ingestion_job,
    some_bytes,
    stored_bytes,
    upload_cv,
    upload_cv_with_a_raw_filename,
)
from tests.support.mailbox import Mailbox
from tests.support.tenants import an_admin

UNREACHABLE: Final = "http://127.0.0.1:1"


async def test_uploading_a_cv_returns_it_waiting_to_be_read(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(browser, filename="amina-haddad.pdf")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["display_name"] == "amina-haddad.pdf"
    assert body["parsing_status"] == CvParsingStatus.UPLOADED
    assert body["parsed_at"] is None
    assert body["parsing_error"] is None
    assert body["is_current"] is False


async def test_the_upload_stores_the_file_and_hashes_it_itself(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    content = some_bytes("the actual document")

    cv = await an_uploaded_cv(browser, content)

    row = await cv_row(db_session, cv["id"])
    assert row.file_hash == hashlib.sha256(content).hexdigest()
    assert row.storage_path.startswith(f"{row.candidate_id}/")
    assert await stored_bytes(storage, db_session, cv["id"]) == content


async def test_the_upload_enqueues_the_parse_job(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    cv = await an_uploaded_cv(browser)

    job = await ingestion_job(db_session, cv["id"])
    assert job.status is IngestionStatus.PENDING
    assert job.attempts == 0
    assert job.started_at is None


async def test_uploading_the_same_file_twice_is_refused_with_the_cv_it_already_is(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    content = some_bytes("one and the same")
    first = await an_uploaded_cv(browser, content)

    again = await upload_cv(browser, content)

    assert again.status_code == 409, again.text
    problem = again.json()
    assert problem["type"].endswith("duplicate-cv")
    assert problem["cv_id"] == first["id"]


async def test_two_candidates_may_upload_the_same_file(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox, "amina")
    await a_signed_in_candidate(other_browser, mailbox, "bashir")
    content = some_bytes("a popular template")

    mine = await an_uploaded_cv(browser, content)
    theirs = await an_uploaded_cv(other_browser, content)

    assert mine["id"] != theirs["id"]


async def test_two_simultaneous_uploads_of_one_file_leave_one_cv(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    content = some_bytes("simultaneous")

    first, second = await asyncio.gather(upload_cv(browser, content), upload_cv(browser, content))

    statuses = sorted([first.status_code, second.status_code])
    assert statuses == [201, 409], (first.text, second.text)
    created = first if first.status_code == 201 else second
    refused = second if first.status_code == 201 else first
    assert refused.json()["cv_id"] == created.json()["id"]

    assert await cv_object_count(db_session) == 1
    assert await stored_bytes(storage, db_session, created.json()["id"]) == content


async def test_a_different_file_is_a_second_cv(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    first = await an_uploaded_cv(browser, some_bytes("one"))
    second = await an_uploaded_cv(browser, some_bytes("two"))

    assert first["id"] != second["id"]


async def test_a_file_that_is_not_a_cv_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(browser, filename="cv.txt", media_type="text/plain")

    assert response.status_code == 415, response.text
    assert response.json()["type"].endswith("unsupported-cv-media-type")


async def test_a_filename_with_a_control_character_keeps_the_rest_of_the_name(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(browser, filename="amina-haddad\x7f.pdf")

    assert response.status_code == 201, response.text
    assert response.json()["display_name"] == "amina-haddad.pdf"


async def test_a_filename_that_is_only_control_characters_falls_back_to_cv(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv_with_a_raw_filename(browser, filename="\x00\x01")

    assert response.status_code == 201, response.text
    assert response.json()["display_name"] == "CV"


async def test_a_filename_with_a_null_byte_keeps_the_rest_of_the_name(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv_with_a_raw_filename(browser, filename="amina-haddad\x00.pdf")

    assert response.status_code == 201, response.text
    assert response.json()["display_name"] == "amina-haddad.pdf"


async def test_a_word_document_a_browser_could_not_name_is_still_accepted(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(
        browser,
        A_REAL_DOCX_CV.read_bytes(),
        filename="cv.docx",
        media_type="application/octet-stream",
    )

    assert response.status_code == 201, response.text
    row = await cv_row(db_session, response.json()["id"])
    assert row.storage_path.endswith(".docx")


@pytest.mark.parametrize(
    ("filename", "media_type", "content"),
    [
        pytest.param("cv.pdf", PDF, A_REAL_PDF_CV.read_bytes(), id="pdf"),
        pytest.param(
            "cv.docx",
            DOCX,
            A_REAL_DOCX_CV.read_bytes(),
            id="docx",
        ),
        pytest.param(
            "cv.doc",
            "application/msword",
            b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1minimal-doc",
            id="doc",
        ),
    ],
)
async def test_a_cv_with_matching_signature_is_accepted(
    browser: AsyncClient, mailbox: Mailbox, filename: str, media_type: str, content: bytes
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(browser, content, filename=filename, media_type=media_type)

    assert response.status_code == 201, response.text


async def test_arbitrary_bytes_declared_as_pdf_are_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(
        browser, b"this is not a document", filename="cv.pdf", media_type=PDF
    )

    assert response.status_code == 415, response.text
    assert response.json()["type"].endswith("unsupported-cv-media-type")
    assert await cv_object_count(db_session) == 0


async def test_a_cv_over_the_ceiling_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(browser, b"x" * (10 * 1024 * 1024 + 1))

    assert response.status_code == 413, response.text
    assert response.json()["type"].endswith("cv-too-large")
    assert await cv_object_count(db_session) == 0


async def test_an_empty_file_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_cv(browser, b"")

    assert response.status_code == 422, response.text
    assert response.json()["type"].endswith("cv-empty")


async def test_polling_a_cv_reports_where_it_has_got_to(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)

    response = await browser.get(f"{CVS}/{cv['id']}")

    assert response.status_code == 200, response.text
    assert response.json() == cv


async def test_another_candidates_cv_is_not_found(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox, "amina")
    mine = await an_uploaded_cv(browser)
    await a_signed_in_candidate(other_browser, mailbox, "bashir")

    response = await other_browser.get(f"{CVS}/{mine['id']}")

    assert response.status_code == 404, response.text
    assert response.json()["type"].endswith("cv-not-found")


async def test_a_cv_that_does_not_exist_is_not_found(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(f"{CVS}/8ad0e2f0-0000-4000-8000-000000000000")

    assert response.status_code == 404, response.text


async def test_the_download_link_fetches_the_file_back(
    browser: AsyncClient, mailbox: Mailbox, web: AsyncClient
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    content = some_bytes("download me")
    cv = await an_uploaded_cv(browser, content)

    response = await browser.get(f"{CVS}/{cv['id']}/download")

    assert response.status_code == 200, response.text
    link = response.json()
    assert link["expires_in_seconds"] > 0
    fetched = await web.get(link["url"])
    assert fetched.status_code == 200, fetched.text
    assert fetched.content == content


async def test_a_download_link_is_only_for_the_owner(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox, "amina")
    mine = await an_uploaded_cv(browser)
    await a_signed_in_candidate(other_browser, mailbox, "bashir")

    response = await other_browser.get(f"{CVS}/{mine['id']}/download")

    assert response.status_code == 404, response.text


@pytest.mark.parametrize(
    "method,path",
    [("post", CVS), ("get", f"{CVS}/{'0' * 8}-0000-4000-8000-000000000000")],
)
async def test_cv_routes_need_a_session(browser: AsyncClient, method: str, path: str) -> None:
    response = await getattr(browser, method)(path)

    assert response.status_code == 401, response.text


async def test_a_recruiter_has_no_cvs(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)

    response = await upload_cv(browser)

    assert response.status_code == 403, response.text
    assert response.json()["type"].endswith("candidate-only")


async def test_a_cv_whose_file_has_gone_says_so_rather_than_crashing(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    await storage.remove((await cv_row(db_session, cv["id"])).storage_path)

    response = await browser.get(f"{CVS}/{cv['id']}/download")

    assert response.status_code == 502, response.text
    assert response.json()["type"].endswith("cv-file-unavailable")


async def test_an_upload_during_a_storage_outage_is_a_bad_gateway(
    browser: AsyncClient, mailbox: Mailbox, app: FastAPI, settings: Settings
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    unreachable = Storage.build(settings.model_copy(update={"supabase_url": UNREACHABLE}))
    app.dependency_overrides[get_storage] = lambda: unreachable
    try:
        response = await upload_cv(browser)
    finally:
        app.dependency_overrides.clear()
        await unreachable.aclose()

    assert response.status_code == 502, response.text
    assert response.json()["type"].endswith("storage-unavailable")
