from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import delete, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core import Database, Storage, transaction
from sync_core.models import Cv, CvParsingStatus, IngestionJob, IngestionStatus
from sync_core.notifications import CvParseFailed, payload_of
from sync_parsers import CvFile, ParsedCv, UnreadableCvError, Vocabulary
from tests.support.candidates import a_signed_in_candidate
from tests.support.cvs import an_uploaded_cv, cv_row
from tests.support.extractors import FakeExtractor, a_parse
from tests.support.mailbox import Mailbox
from tests.support.notifications import (
    NOTIFICATIONS,
    UNREADABLE,
    failed_parses,
    mark_read,
    my_notifications,
    my_unread_count,
)
from tests.support.profiles import my_id
from tests.support.worker import an_ingestion_worker

A_CV = uuid4()


class UnavailableError(Exception):
    pass


async def test_a_new_candidate_has_nothing_to_read(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(NOTIFICATIONS)

    assert response.status_code == 200, response.text
    assert response.json() == {"items": [], "next_cursor": None}


async def test_notifications_are_not_readable_without_a_session(browser: AsyncClient) -> None:
    response = await browser.get(NOTIFICATIONS)

    assert response.status_code == 401, response.text


async def test_a_cv_the_platform_gave_up_on_reaches_the_bell(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    unreadable = FakeExtractor(UnreadableCvError(UNREADABLE))

    await an_ingestion_worker(database, storage, unreadable).run_once()

    items = await my_notifications(browser)
    assert len(items) == 1, items
    assert items[0]["payload"] == {
        "type": "cv_parse_failed",
        "cv_id": cv["id"],
        "display_name": "cv.pdf",
    }
    assert items[0]["read_at"] is None


async def test_a_parse_still_being_retried_says_nothing(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    down = FakeExtractor(UnavailableError("OpenAI is down"))

    await an_ingestion_worker(database, storage, down, max_attempts=2).run_once()

    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.PROCESSING
    assert await my_notifications(browser) == []


async def test_running_out_of_attempts_notifies_exactly_once(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(
        database, storage, FakeExtractor(UnavailableError("still down")), max_attempts=2
    )

    await worker.run_once()
    assert await my_notifications(browser) == [], "a retry left is not a failure to announce"
    await worker.run_once()

    items = await my_notifications(browser)
    assert len(items) == 1, items
    assert items[0]["payload"] == {
        "type": "cv_parse_failed",
        "cv_id": cv["id"],
        "display_name": "cv.pdf",
    }
    assert items[0]["read_at"] is None


async def test_a_retry_that_works_says_nothing_at_all(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await an_uploaded_cv(browser)
    worker = an_ingestion_worker(
        database, storage, FakeExtractor(UnavailableError("a blip"), a_parse())
    )

    await worker.run_once()
    await worker.run_once()

    assert await my_notifications(browser) == []


async def test_a_job_buried_by_the_sweep_notifies_too(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(
        database, storage, FakeExtractor(), max_attempts=1, stuck_after_seconds=60
    )
    await db_session.execute(
        update(IngestionJob)
        .where(IngestionJob.cv_id == cv["id"])
        .values(
            status=IngestionStatus.PROCESSING,
            attempts=1,
            started_at=datetime.now(UTC) - timedelta(minutes=5),
        )
    )
    await db_session.commit()

    assert await worker.sweep() == 1

    items = await my_notifications(browser)
    assert len(items) == 1, items
    assert items[0]["payload"]["cv_id"] == cv["id"]


async def test_a_cv_deleted_mid_parse_leaves_nobody_to_tell(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    vanishing = DeletingExtractor(database, UUID(cv["id"]))

    assert await an_ingestion_worker(database, storage, vanishing).run_once() is True

    assert await my_notifications(browser) == []
    assert await my_unread_count(browser) == 0


async def test_the_bell_counts_only_what_has_not_been_read(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await failed_parses(browser, database, storage, how_many=2)
    assert await my_unread_count(browser) == 2

    newest, _older = await my_notifications(browser)
    marked = await mark_read(browser, newest["id"])

    assert marked.status_code == 200, marked.text
    assert marked.json()["read_at"] is not None
    assert await my_unread_count(browser) == 1


async def test_a_notification_marked_read_stays_read_in_the_list(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await failed_parses(browser, database, storage)
    (notification,) = await my_notifications(browser)

    await mark_read(browser, notification["id"])

    (again,) = await my_notifications(browser)
    assert again["read_at"] is not None
    assert again["id"] == notification["id"]


async def test_marking_read_twice_keeps_the_first_time(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await failed_parses(browser, database, storage)
    (notification,) = await my_notifications(browser)

    first = await mark_read(browser, notification["id"])
    second = await mark_read(browser, notification["id"])

    assert second.status_code == 200, second.text
    assert second.json()["read_at"] == first.json()["read_at"]
    assert await my_unread_count(browser) == 0


async def test_marking_something_that_is_not_a_notification_is_a_404(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await mark_read(browser, "00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404, response.text
    assert response.json()["type"] == "urn:sync:problem:notification-not-found"


async def test_one_candidates_notifications_are_invisible_to_another(
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox, "owner")
    await failed_parses(browser, database, storage)
    await a_signed_in_candidate(other_browser, mailbox, "stranger")

    assert await my_notifications(other_browser) == []
    assert await my_unread_count(other_browser) == 0


async def test_a_stranger_cannot_mark_somebody_elses_notification_read(
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    database: Database,
    storage: Storage,
) -> None:
    await a_signed_in_candidate(browser, mailbox, "owner")
    await failed_parses(browser, database, storage)
    (notification,) = await my_notifications(browser)
    await a_signed_in_candidate(other_browser, mailbox, "stranger")

    refused = await mark_read(other_browser, notification["id"])

    assert refused.status_code == 404, refused.text
    assert await my_unread_count(browser) == 1, "the owner's notification was marked read"


async def test_the_list_is_newest_first_and_pages_by_cursor(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    oldest, middle, newest = await failed_parses(browser, database, storage, how_many=3)

    first_page = await browser.get(NOTIFICATIONS, params={"limit": 2})
    assert first_page.status_code == 200, first_page.text
    body = first_page.json()
    assert [item["payload"]["cv_id"] for item in body["items"]] == [newest["id"], middle["id"]]
    assert body["next_cursor"] is not None

    second_page = await browser.get(
        NOTIFICATIONS, params={"limit": 2, "cursor": body["next_cursor"]}
    )
    assert second_page.status_code == 200, second_page.text
    rest = second_page.json()
    assert [item["payload"]["cv_id"] for item in rest["items"]] == [oldest["id"]]
    assert rest["next_cursor"] is None, "the last page must say it is the last page"


async def test_a_full_final_page_ends_the_paging(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    await failed_parses(browser, database, storage, how_many=2)

    page = await browser.get(NOTIFICATIONS, params={"limit": 2})

    assert len(page.json()["items"]) == 2
    assert page.json()["next_cursor"] is None


async def test_a_cursor_this_api_did_not_issue_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(NOTIFICATIONS, params={"cursor": "not-a-cursor"})

    assert response.status_code == 422, response.text
    assert response.json()["type"] == "urn:sync:problem:invalid-cursor"


async def test_a_limit_the_api_will_not_serve_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(NOTIFICATIONS, params={"limit": 5000})

    assert response.status_code == 422, response.text


def test_a_stored_payload_is_read_back_as_the_shape_its_type_names() -> None:
    failed = payload_of(
        {"type": "cv_parse_failed", "cv_id": str(A_CV), "display_name": "resume.pdf"}
    )

    assert failed == CvParseFailed(cv_id=A_CV, display_name="resume.pdf")


def test_the_type_is_mandatory_and_has_to_be_one_the_platform_knows() -> None:
    with pytest.raises(ValidationError):
        payload_of({"cv_id": str(A_CV), "display_name": "resume.pdf"})

    with pytest.raises(ValidationError):
        payload_of({"type": "the_sky_is_falling", "cv_id": str(A_CV)})


def test_a_payload_of_the_wrong_shape_for_its_type_is_refused() -> None:
    with pytest.raises(ValidationError):
        payload_of({"type": "cv_parse_failed", "display_name": "resume.pdf"})


async def test_the_database_refuses_a_payload_filed_under_another_type(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    recipient = await my_id(browser)

    with pytest.raises(IntegrityError):
        await db_session.execute(
            text(
                "insert into notifications (recipient_profile_id, type, payload) "
                "values (:recipient, 'cv_parse_failed', "
                '\'{"type": "application_status_changed"}\'::jsonb)'
            ),
            {"recipient": recipient},
        )
    await db_session.rollback()


class DeletingExtractor:
    def __init__(self, database: Database, cv_id: UUID) -> None:
        self._database = database
        self._cv_id = cv_id

    async def extract(self, file: CvFile, vocabulary: Vocabulary) -> ParsedCv:
        async with self._database.session() as session, transaction(session):
            await session.execute(delete(Cv).where(Cv.id == self._cv_id))
        raise UnreadableCvError(UNREADABLE)
