"""The bell icon: what a Profile has been told, and what they have read.

Seam 1 throughout — every test asks the API what the caller's notifications are, rather than
reading the table. The producer tests are seam 3 on top of it: a CV is uploaded over HTTP,
one worker cycle runs, and the notification is observed through the list endpoint, which is
the whole point of the feature.
"""

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
from sync_core.models import ApplicationStatus, Cv, CvParsingStatus, IngestionJob, IngestionStatus
from sync_core.notifications import ApplicationStatusChanged, CvParseFailed, payload_of
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

#: Ids for the payload tests, which are about the shapes rather than about any real row.
A_CV = uuid4()
AN_APPLICATION = uuid4()


class UnavailableError(Exception):
    """What a provider having a moment looks like: retry this, and say nothing yet."""


async def test_a_new_candidate_has_nothing_to_read(browser: AsyncClient, mailbox: Mailbox) -> None:
    """The empty state is a page, not a 404 — the bell renders the same way either way."""
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(NOTIFICATIONS)

    assert response.status_code == 200, response.text
    assert response.json() == {"items": [], "next_cursor": None}


async def test_notifications_are_not_readable_without_a_session(browser: AsyncClient) -> None:
    response = await browser.get(NOTIFICATIONS)

    assert response.status_code == 401, response.text


# The parse-failure producer ---------------------------------------------------


async def test_a_cv_the_platform_gave_up_on_reaches_the_bell(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """The whole point of the ticket: a failed parse is no longer silence.

    Seam 3 on top of seam 1 — a real upload, one real worker cycle, and the notification read
    back through the endpoint the SPA polls.
    """
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
    """A notification cannot be withdrawn, so it waits until the platform has given up.

    The CV is still `processing` at this point — telling a candidate their upload failed
    while it is being retried would be a message the platform has to take back.
    """
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    down = FakeExtractor(UnavailableError("OpenAI is down"))

    await an_ingestion_worker(database, storage, down, max_attempts=2).run_once()

    assert (await cv_row(db_session, cv["id"])).parsing_status is CvParsingStatus.PROCESSING
    assert await my_notifications(browser) == []


async def test_running_out_of_attempts_notifies_exactly_once(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """One CV, one message — however many attempts it took to establish that."""
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    worker = an_ingestion_worker(
        database, storage, FakeExtractor(UnavailableError("still down")), max_attempts=2
    )

    await worker.run_once()
    await worker.run_once()

    items = await my_notifications(browser)
    assert len(items) == 1, items
    assert items[0]["payload"]["cv_id"] == cv["id"]


async def test_a_retry_that_works_says_nothing_at_all(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """The failure the candidate never needed to know about."""
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
    """A worker dying on the last attempt must not cost the candidate their message.

    The sweep buries the job instead of the worker that claimed it, and the notification is
    written in that transaction just the same.
    """
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
    """The failure that has no recipient: the CV, and the row naming its owner, are gone.

    Worth its own test because the notification's recipient comes off the `cvs` row. Writing
    one for a row that no longer exists would fail the engine's whole transaction and leave
    the job stuck `processing` — one deleted CV taking the queue down with it.
    """
    await a_signed_in_candidate(browser, mailbox)
    cv = await an_uploaded_cv(browser)
    vanishing = DeletingExtractor(database, UUID(cv["id"]))

    assert await an_ingestion_worker(database, storage, vanishing).run_once() is True

    assert await my_notifications(browser) == []
    assert await my_unread_count(browser) == 0


# Unread, and marking read -----------------------------------------------------


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
    """Read state is the notification's own, not something the list forgets."""
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
    """The SPA marks on render, so this happens every time the list is opened."""
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


# Only ever the recipient's ----------------------------------------------------


async def test_one_candidates_notifications_are_invisible_to_another(
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    database: Database,
    storage: Storage,
) -> None:
    """A Notification is addressed to one Profile. Nobody else has a list containing it."""
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
    """404, not 403: a caller must not be able to tell somebody else's id from a made-up one."""
    await a_signed_in_candidate(browser, mailbox, "owner")
    await failed_parses(browser, database, storage)
    (notification,) = await my_notifications(browser)
    await a_signed_in_candidate(other_browser, mailbox, "stranger")

    refused = await mark_read(other_browser, notification["id"])

    assert refused.status_code == 404, refused.text
    assert await my_unread_count(browser) == 1, "the owner's notification was marked read"


# Paging -----------------------------------------------------------------------


async def test_the_list_is_newest_first_and_pages_by_cursor(
    browser: AsyncClient, mailbox: Mailbox, database: Database, storage: Storage
) -> None:
    """Three notifications, two pages, and every one of them seen exactly once."""
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
    """A page as long as the limit is not evidence of another one behind it."""
    await a_signed_in_candidate(browser, mailbox)
    await failed_parses(browser, database, storage, how_many=2)

    page = await browser.get(NOTIFICATIONS, params={"limit": 2})

    assert len(page.json()["items"]) == 2
    assert page.json()["next_cursor"] is None


async def test_a_cursor_this_api_did_not_issue_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Better than the arbitrary page a lenient parse would answer with."""
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(NOTIFICATIONS, params={"cursor": "not-a-cursor"})

    assert response.status_code == 422, response.text
    assert response.json()["type"] == "urn:sync:problem:invalid-cursor"


async def test_a_limit_the_api_will_not_serve_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The ceiling is the API's, not the caller's — an unbounded list is a way to make one."""
    await a_signed_in_candidate(browser, mailbox)

    response = await browser.get(NOTIFICATIONS, params={"limit": 5000})

    assert response.status_code == 422, response.text


# The payload union ------------------------------------------------------------


def test_a_stored_payload_is_read_back_as_the_shape_its_type_names() -> None:
    """The discriminator is the contract: one field decides what the rest of the object is."""
    failed = payload_of(
        {"type": "cv_parse_failed", "cv_id": str(A_CV), "display_name": "resume.pdf"}
    )
    moved = payload_of(
        {
            "type": "application_status_changed",
            "application_id": str(AN_APPLICATION),
            "job_title": "Backend Engineer",
            "previous_status": "new",
            "new_status": "shortlisted",
        }
    )

    assert failed == CvParseFailed(cv_id=A_CV, display_name="resume.pdf")
    assert moved == ApplicationStatusChanged(
        application_id=AN_APPLICATION,
        job_title="Backend Engineer",
        previous_status=ApplicationStatus.NEW,
        new_status=ApplicationStatus.SHORTLISTED,
    )


def test_the_type_is_mandatory_and_has_to_be_one_the_platform_knows() -> None:
    """Without it there is no union, only a guess at which shape was meant."""
    with pytest.raises(ValidationError):
        payload_of({"cv_id": str(A_CV), "display_name": "resume.pdf"})

    with pytest.raises(ValidationError):
        payload_of({"type": "the_sky_is_falling", "cv_id": str(A_CV)})


def test_a_payload_of_the_wrong_shape_for_its_type_is_refused() -> None:
    """A `cv_parse_failed` is a cv_parse_failed's fields — the type is not a label to attach."""
    with pytest.raises(ValidationError):
        payload_of({"type": "cv_parse_failed", "application_id": str(AN_APPLICATION)})


def test_only_the_payloads_about_an_application_name_one() -> None:
    """What fills `notifications.application_id`, so the column cannot contradict the payload."""
    assert CvParseFailed(cv_id=A_CV, display_name="resume.pdf").about_application is None
    assert (
        ApplicationStatusChanged(
            application_id=AN_APPLICATION,
            job_title="Backend Engineer",
            previous_status=ApplicationStatus.NEW,
            new_status=ApplicationStatus.REJECTED,
        ).about_application
        == AN_APPLICATION
    )


async def test_the_database_refuses_a_payload_filed_under_another_type(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The migration's CHECK, which no route can demonstrate — `notify` fills both from one
    payload, so the only producer that could disagree with itself is a future one."""
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
    """A CV that disappears while the worker is holding it.

    The only way to reach the pipeline's missing-row path, and not a contrived one: a
    candidate deleting a CV mid-parse does exactly this. Between the claim and the burial is
    the only moment it can be arranged in — the pipeline reads the row on the way in and the
    notification's recipient off it on the way out.
    """

    def __init__(self, database: Database, cv_id: UUID) -> None:
        self._database = database
        self._cv_id = cv_id

    async def extract(self, file: CvFile, vocabulary: Vocabulary) -> ParsedCv:
        async with self._database.session() as session, transaction(session):
            # Cascades into `ingestion_jobs`, so the claimed job goes with it.
            await session.execute(delete(Cv).where(Cv.id == self._cv_id))
        raise UnreadableCvError(UNREADABLE)
