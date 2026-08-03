from __future__ import annotations

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
from tests.support.profiles import my_id, my_profile_draft
from tests.support.senders import CapturingSender
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


async def test_the_parse_reaches_the_candidate_as_a_profile_draft(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    too_early = await my_profile_draft(browser, cv["id"])
    assert too_early.status_code == 409, too_early.text
    assert too_early.json()["type"] == "urn:sync:problem:cv-not-ready"

    await an_ingestion_worker(database, storage, FakeExtractor()).run_once()

    polled = await browser.get(f"{CVS}/{cv['id']}")
    assert polled.json()["parsing_status"] == CvParsingStatus.READY
    assert polled.json()["is_current"] is True
    draft = await my_profile_draft(browser, cv["id"])
    assert draft.status_code == 200, draft.text
    assert draft.json()["headline"] == "Backend engineer, 8 years"
    assert [skill["name"] for skill in draft.json()["skills"]] == ["Python", "PostgreSQL"]


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

    draft = (await my_profile_draft(browser, cv["id"])).json()
    assert [skill["name"] for skill in draft["skills"]] == ["Python"]
    assert draft["unmapped_skills"] == ["Quantum Blockchain Alignment"]


async def test_a_canonical_skill_in_the_wrong_case_is_kept_in_the_platforms_spelling(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    shouted = a_parse(
        skills=[ParsedSkill(name="postgreSQL", years_experience=None)], unmapped_skills=[]
    )

    await an_ingestion_worker(database, storage, FakeExtractor(shouted)).run_once()

    draft = (await my_profile_draft(browser, cv["id"])).json()
    assert [skill["name"] for skill in draft["skills"]] == ["PostgreSQL"]
    assert draft["unmapped_skills"] == []


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


async def test_the_worker_drains_the_queue_and_returns(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, settings: Settings
) -> None:
    """Draining terminates on its own once the queue is empty — no cancellation needed.

    The polling version had to be started as a task, waited on until the row changed, then
    cancelled, which is why it failed intermittently. A drain either finishes or it doesn't.
    """
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = Worker(settings, FakeExtractor(), FakeEmbedder(), CapturingSender())

    try:
        report = await worker.drain()
    finally:
        await worker.aclose()

    assert report.processed["ingestion"] == 1
    assert report.truncated == []
    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.READY


async def test_the_scheduled_call_recovers_a_row_no_notification_arrived_for(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, settings: Settings
) -> None:
    """The dropped-webhook case: nothing tells the worker, and the schedule finishes it."""
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = Worker(settings, FakeExtractor(), FakeEmbedder(), CapturingSender())

    try:
        report = await worker.scheduled()
    finally:
        await worker.aclose()

    assert report.processed["ingestion"] == 1
    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.READY


async def test_the_scheduled_call_finishes_a_row_a_crashed_invocation_abandoned(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, settings: Settings
) -> None:
    """Sweeping alone would only return it to pending; the drain in the same call finishes it."""
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    await _abandon_the_claim(db_session, cv["id"], claimed_ago=timedelta(minutes=15))
    worker = Worker(settings, FakeExtractor(), FakeEmbedder(), CapturingSender())

    try:
        report = await worker.scheduled()
    finally:
        await worker.aclose()

    assert report.swept["ingestion"] == 1
    assert report.processed["ingestion"] == 1
    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.READY
