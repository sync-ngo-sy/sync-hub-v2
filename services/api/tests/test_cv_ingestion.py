from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core import Database, Settings, Storage
from sync_core.models import Candidate, CvParsingStatus, IngestionJob, IngestionStatus
from sync_parsers import ParsedSkill, UnreadableCvError
from sync_worker import RetryPolicy
from sync_worker.worker import Worker
from tests.support.candidates import a_signed_in_candidate
from tests.support.cvs import CVS, an_uploaded_cv, cv_row, ingestion_job, some_bytes
from tests.support.embedders import FakeEmbedder
from tests.support.extractors import FakeExtractor, a_parse
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id
from tests.support.worker import an_ingestion_worker


class UnavailableError(Exception):
    pass


async def test_a_claimed_cv_becomes_ready_with_its_parse(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(database, storage, FakeExtractor())

    assert await worker.run_once() is True

    row = await cv_row(db_session, cv["id"])
    assert row.parsing_status is CvParsingStatus.READY
    assert row.parsed_at is not None
    assert row.parsing_error is None
    assert row.detected_language == "en"
    assert row.parsed_cv_data is not None
    assert row.parsed_cv_data["full_name"] == "Amina Haddad"

    job = await ingestion_job(db_session, cv["id"])
    assert job.status is IngestionStatus.COMPLETED
    assert job.attempts == 1
    assert job.completed_at is not None


async def test_the_parse_reaches_the_candidate_through_the_polling_endpoint(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    waiting = await browser.get(f"{CVS}/{cv['id']}")
    assert waiting.json()["parsed_cv"] is None

    await an_ingestion_worker(database, storage, FakeExtractor()).run_once()

    response = await browser.get(f"{CVS}/{cv['id']}")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["parsing_status"] == CvParsingStatus.READY
    assert body["parsed_cv"]["headline"] == "Backend engineer, 8 years"
    assert [skill["name"] for skill in body["parsed_cv"]["skills"]] == ["Python", "PostgreSQL"]
    assert body["is_current"] is True


async def test_the_worker_is_sent_the_file_and_the_platforms_vocabulary(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    content = some_bytes("the real bytes")
    await an_uploaded_cv(browser, content)
    extractor = FakeExtractor()

    await an_ingestion_worker(database, storage, extractor).run_once()

    document, vocabulary = extractor.calls[0]
    assert document.content == content
    assert document.media_type == "application/pdf"
    assert document.filename.endswith(".pdf")
    assert "Python" in vocabulary.canonical_skills
    assert "ar" in vocabulary.language_codes


async def test_the_first_ready_cv_becomes_current_and_later_ones_do_not(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    first = await an_uploaded_cv(browser, some_bytes("first"))
    second = await an_uploaded_cv(browser, some_bytes("second"))
    worker = an_ingestion_worker(database, storage, FakeExtractor())

    await worker.run_once()
    await worker.run_once()

    db_session.expire_all()
    candidate = await db_session.get(Candidate, candidate_id)
    assert candidate is not None
    assert candidate.current_cv_id is not None
    assert str(candidate.current_cv_id) == first["id"]
    assert str(candidate.current_cv_id) != second["id"]


async def test_a_failed_cv_never_becomes_current(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await an_uploaded_cv(browser)
    worker = an_ingestion_worker(database, storage, FakeExtractor(UnreadableCvError("scanned")))

    await worker.run_once()

    db_session.expire_all()
    candidate = await db_session.get(Candidate, candidate_id)
    assert candidate is not None
    assert candidate.current_cv_id is None


async def test_an_empty_queue_is_no_work(database: Database, storage: Storage) -> None:
    assert await an_ingestion_worker(database, storage, FakeExtractor()).run_once() is False


async def test_a_transient_failure_is_retried_and_the_cv_keeps_waiting(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    down = FakeExtractor(UnavailableError("OpenAI is down"))
    worker = an_ingestion_worker(database, storage, down)

    await worker.run_once()

    job = await ingestion_job(db_session, cv["id"])
    assert job.status is IngestionStatus.PENDING
    assert job.attempts == 1
    assert job.available_at is not None
    assert job.error_message is not None
    assert "UnavailableError" in job.error_message

    row = await cv_row(db_session, cv["id"])
    assert row.parsing_status is CvParsingStatus.PROCESSING
    assert row.parsing_error is None


async def test_a_retry_that_works_leaves_a_ready_cv(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    extractor = FakeExtractor(UnavailableError("a blip"), a_parse())
    worker = an_ingestion_worker(database, storage, extractor)

    await worker.run_once()
    await worker.run_once()

    assert extractor.call_count == 2
    row = await cv_row(db_session, cv["id"])
    assert row.parsing_status is CvParsingStatus.READY
    job = await ingestion_job(db_session, cv["id"])
    assert job.status is IngestionStatus.COMPLETED
    assert job.attempts == 2


async def test_exhausting_the_attempts_fails_the_cv_with_a_reason(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(
        database, storage, FakeExtractor(UnavailableError("still down")), max_attempts=2
    )

    await worker.run_once()
    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.PROCESSING
    await worker.run_once()

    row = await cv_row(db_session, cv["id"])
    assert row.parsing_status is CvParsingStatus.FAILED
    assert row.parsing_error is not None
    assert "still down" in row.parsing_error

    job = await ingestion_job(db_session, cv["id"])
    assert job.status is IngestionStatus.FAILED
    assert job.attempts == 2


async def test_a_document_that_cannot_be_read_is_not_tried_again(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    extractor = FakeExtractor(UnreadableCvError("this is a photograph of a cat"))
    worker = an_ingestion_worker(database, storage, extractor, max_attempts=3)

    await worker.run_once()

    assert extractor.call_count == 1
    assert await worker.run_once() is False, "a settled job must not be claimable again"

    row = await cv_row(db_session, cv["id"])
    assert row.parsing_status is CvParsingStatus.FAILED
    assert row.parsing_error is not None
    assert "photograph of a cat" in row.parsing_error
    assert (await ingestion_job(db_session, cv["id"])).status is IngestionStatus.FAILED


async def test_a_cv_whose_file_is_gone_fails_permanently(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    await storage.remove((await cv_row(db_session, cv["id"])).storage_path)
    extractor = FakeExtractor()

    await an_ingestion_worker(database, storage, extractor).run_once()

    assert extractor.call_count == 0
    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.FAILED


async def test_the_sweep_requeues_a_job_whose_worker_died(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(database, storage, FakeExtractor(), stuck_after_seconds=60)
    await _abandon_the_claim(db_session, cv["id"], claimed_ago=timedelta(minutes=5))

    assert await worker.sweep() == 1

    job = await ingestion_job(db_session, cv["id"])
    assert job.status is IngestionStatus.PENDING
    assert job.started_at is None

    await worker.run_once()
    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.READY


async def test_the_sweep_leaves_work_that_is_still_running_alone(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(database, storage, FakeExtractor(), stuck_after_seconds=600)
    await _abandon_the_claim(db_session, cv["id"], claimed_ago=timedelta(seconds=30))

    assert await worker.sweep() == 0
    assert (await ingestion_job(db_session, cv["id"])).status is IngestionStatus.PROCESSING


async def test_the_sweep_buries_a_job_that_died_on_its_last_attempt(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(
        database, storage, FakeExtractor(), max_attempts=2, stuck_after_seconds=60
    )
    await _abandon_the_claim(db_session, cv["id"], claimed_ago=timedelta(minutes=5), attempts=2)

    assert await worker.sweep() == 1

    assert (await ingestion_job(db_session, cv["id"])).status is IngestionStatus.FAILED
    row = await cv_row(db_session, cv["id"])
    assert row.parsing_status is CvParsingStatus.FAILED
    assert row.parsing_error is not None
    assert "stopped responding" in row.parsing_error


async def test_a_skill_the_platform_does_not_know_is_demoted_for_review(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    invented = a_parse(
        skills=[
            ParsedSkill(name="Python", years_experience=8.0),
            ParsedSkill(name="Quantum Blockchain Alignment", years_experience=3.0),
        ],
        unmapped_skills=[],
    )

    await an_ingestion_worker(database, storage, FakeExtractor(invented)).run_once()

    parsed = (await browser.get(f"{CVS}/{cv['id']}")).json()["parsed_cv"]
    assert [skill["name"] for skill in parsed["skills"]] == ["Python"]
    assert parsed["unmapped_skills"] == ["Quantum Blockchain Alignment"]


async def test_a_canonical_skill_in_the_wrong_case_is_kept_in_the_platforms_spelling(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    shouted = a_parse(
        skills=[ParsedSkill(name="postgreSQL", years_experience=None)], unmapped_skills=[]
    )

    await an_ingestion_worker(database, storage, FakeExtractor(shouted)).run_once()

    parsed = (await browser.get(f"{CVS}/{cv['id']}")).json()["parsed_cv"]
    assert [skill["name"] for skill in parsed["skills"]] == ["PostgreSQL"]
    assert parsed["unmapped_skills"] == []


@pytest.mark.parametrize("attempts,seconds", [(1, 10), (2, 20), (3, 40)])
def test_the_backoff_doubles_per_attempt(attempts: int, seconds: float) -> None:
    policy = RetryPolicy(max_attempts=5, backoff_seconds=10, stuck_after_seconds=600)

    assert policy.delay_after(attempts) == timedelta(seconds=seconds)


def test_attempts_run_out_at_the_maximum() -> None:
    policy = RetryPolicy(max_attempts=3, backoff_seconds=10, stuck_after_seconds=600)

    assert policy.is_exhausted(2) is False
    assert policy.is_exhausted(3) is True


async def _abandon_the_claim(
    session: AsyncSession, cv_id: str, *, claimed_ago: timedelta, attempts: int = 1
) -> None:
    await session.execute(
        update(IngestionJob)
        .where(IngestionJob.cv_id == cv_id)
        .values(
            status=IngestionStatus.PROCESSING,
            attempts=attempts,
            started_at=datetime.now(UTC) - claimed_ago,
        )
    )
    await session.commit()


async def test_the_worker_process_drains_the_queue_and_stops_cleanly(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, settings: Settings
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = Worker(
        settings.model_copy(
            update={"worker_poll_interval_seconds": 0.05, "worker_idle_backoff_max_seconds": 0.05}
        ),
        FakeExtractor(),
        FakeEmbedder(),
    )

    running = asyncio.create_task(worker.run())
    try:
        await _until_ready(db_session, cv["id"])
    finally:
        running.cancel()
        with suppress(asyncio.CancelledError):
            await running

    assert running.done()
    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.READY


async def _until_ready(session: AsyncSession, cv_id: str, *, within: float = 10.0) -> None:
    deadline = asyncio.get_running_loop().time() + within
    while asyncio.get_running_loop().time() < deadline:
        status = (await cv_row(session, cv_id)).parsing_status
        if status is CvParsingStatus.READY:
            return
        await asyncio.sleep(0.05)
    raise AssertionError(f"cv {cv_id} was still {status} after {within}s")
