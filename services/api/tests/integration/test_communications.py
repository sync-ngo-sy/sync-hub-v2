from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from httpx import AsyncClient
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_comms import EmailUnavailableError, UnsendableEmailError
from sync_core import Database
from sync_core.communications import ApplicationConfirmation, ApplicationRejection
from sync_core.models import (
    ApplicationStatus,
    Communication,
    CommunicationChannel,
    CommunicationStatus,
)
from tests.support.applications import (
    a_moved_application,
    an_accepted_application,
    communications_of,
    the_telling_comes,
)
from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.profiles import (
    a_filled_profile,
    a_saved_profile,
    give_a_current_cv,
    my_id,
)
from tests.support.senders import PROVIDER, CapturingSender
from tests.support.worker import a_communications_worker


@dataclass(frozen=True, slots=True)
class Awaiting:
    """A submitted Application whose confirmation is sitting in the queue."""

    communication_id: UUID
    candidate_email: str
    job_title: str
    tenant_name: str


async def an_application_awaiting_its_confirmation(
    recruiter: AsyncClient, browser: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> Awaiting:
    job = await a_published_job(recruiter)
    signup = await a_signed_in_candidate(browser, mailbox, "applicant")
    await give_a_current_cv(session, await my_id(browser))
    await a_saved_profile(browser, a_filled_profile())
    application = await an_accepted_application(browser, job["id"])

    [queued] = await communications_of(session, application["id"])
    assert queued.status is CommunicationStatus.QUEUED
    return Awaiting(
        communication_id=queued.id,
        candidate_email=signup.email,
        job_title=job["title"],
        tenant_name=queued.payload["tenant_name"],
    )


async def reread(session: AsyncSession, communication_id: UUID) -> Communication:
    session.expire_all()
    row = await session.get(Communication, communication_id)
    assert row is not None, f"no communications row for {communication_id}"
    return row


async def test_the_confirmation_is_rendered_and_delivered_to_the_candidate(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    sender = CapturingSender()

    assert await a_communications_worker(database, sender).run_once() is True

    delivered = sender.only()
    assert delivered.to == awaiting.candidate_email
    assert awaiting.job_title in delivered.subject
    assert awaiting.tenant_name in delivered.html
    assert "Amina Haddad" in delivered.text


async def test_the_row_keeps_the_providers_evidence(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    sender = CapturingSender()

    await a_communications_worker(database, sender).run_once()

    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.SENT
    assert row.provider == PROVIDER
    assert row.provider_message_id is not None
    assert row.sent_at is not None
    assert row.completed_at is not None
    assert row.attempts == 1
    assert row.error_message is None
    assert row.template_key == ApplicationConfirmation.template_key
    assert row.subject == sender.only().subject


async def test_the_idempotency_key_the_row_carries_is_what_the_provider_is_given(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    queued = await reread(db_session, awaiting.communication_id)
    sender = CapturingSender()

    await a_communications_worker(database, sender).run_once()

    assert sender.only().idempotency_key == queued.idempotency_key


async def test_it_sends_to_the_verified_address_not_the_one_that_was_queued(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    await _returned_to_the_queue(
        db_session, awaiting.communication_id, recipient="stale@example.com"
    )
    sender = CapturingSender()

    await a_communications_worker(database, sender).run_once()

    assert sender.only().to == awaiting.candidate_email
    assert (await reread(db_session, awaiting.communication_id)).recipient == (
        awaiting.candidate_email
    )


async def test_a_candidate_with_no_confirmed_email_is_never_written_to(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    await _unconfirm(db_session, awaiting.candidate_email)
    sender = CapturingSender()
    worker = a_communications_worker(database, sender)

    await worker.run_once()

    assert sender.attempt_count == 0
    assert await worker.run_once() is False, "a settled row must not be claimable again"
    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.FAILED
    assert row.sent_at is None
    assert row.error_message is not None
    assert "confirmed email" in row.error_message


async def test_a_provider_outage_is_retried_and_the_row_keeps_waiting(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    sender = CapturingSender(EmailUnavailableError("Resend did not take the message (code 503)"))

    await a_communications_worker(database, sender).run_once()

    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.QUEUED
    assert row.attempts == 1
    assert row.available_at is not None
    assert row.sent_at is None
    assert row.error_message is not None
    assert "EmailUnavailableError" in row.error_message


async def test_a_retry_that_gets_through_leaves_the_row_sent(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    sender = CapturingSender(EmailUnavailableError("a blip"), None)
    worker = a_communications_worker(database, sender)

    await worker.run_once()
    await worker.run_once()

    assert sender.attempt_count == 2
    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.SENT
    assert row.attempts == 2
    assert len(sender.sent) == 1


async def test_exhausting_the_attempts_leaves_the_row_failed_with_a_reason(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    sender = CapturingSender(EmailUnavailableError("still down"))
    worker = a_communications_worker(database, sender, max_attempts=2)

    await worker.run_once()
    assert (
        await reread(db_session, awaiting.communication_id)
    ).status is CommunicationStatus.QUEUED
    await worker.run_once()

    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.FAILED
    assert row.attempts == 2
    assert row.sent_at is None
    assert row.error_message is not None
    assert "still down" in row.error_message


async def test_a_message_the_provider_refuses_is_not_offered_again(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    sender = CapturingSender(UnsendableEmailError("Resend refused the message: invalid `to`"))
    worker = a_communications_worker(database, sender, max_attempts=3)

    await worker.run_once()

    assert sender.attempt_count == 1
    assert await worker.run_once() is False, "a settled row must not be claimable again"
    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.FAILED
    assert row.attempts == 1


async def test_a_row_naming_no_template_is_failed_without_reaching_the_provider(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    await _returned_to_the_queue(db_session, awaiting.communication_id, template_key=None)
    sender = CapturingSender()

    await a_communications_worker(database, sender).run_once()

    assert sender.attempt_count == 0
    assert (
        await reread(db_session, awaiting.communication_id)
    ).status is CommunicationStatus.FAILED


async def test_a_re_claimed_row_cannot_send_the_message_twice(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    """What the sweep does to a row whose worker died: the provider was handed the message,
    the row never learned. The idempotency key is what keeps the candidate from hearing twice."""
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    sender = CapturingSender()
    worker = a_communications_worker(database, sender)
    await worker.run_once()
    first = await reread(db_session, awaiting.communication_id)
    delivered_id = first.provider_message_id

    await _returned_to_the_queue(db_session, awaiting.communication_id)
    await worker.run_once()

    assert sender.attempt_count == 2
    assert len(sender.sent) == 1, "the provider deduped on the key, as Resend does"
    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.SENT
    assert row.provider_message_id == delivered_id


async def test_a_row_another_worker_is_holding_is_not_claimed_again(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    await _set(db_session, awaiting.communication_id, status=CommunicationStatus.PROCESSING)
    sender = CapturingSender()

    assert await a_communications_worker(database, sender).run_once() is False
    assert sender.attempt_count == 0


async def test_a_message_for_another_channel_is_left_for_its_own_sender(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    awaiting = await an_application_awaiting_its_confirmation(
        recruiter, other_browser, mailbox, db_session
    )
    await _set(db_session, awaiting.communication_id, channel=CommunicationChannel.SMS)
    sender = CapturingSender()

    assert await a_communications_worker(database, sender).run_once() is False

    assert sender.attempt_count == 0
    row = await reread(db_session, awaiting.communication_id)
    assert row.status is CommunicationStatus.QUEUED, "waiting, not buried by the email sender"


async def test_an_empty_queue_is_no_work(database: Database) -> None:
    assert await a_communications_worker(database, CapturingSender()).run_once() is False


async def test_a_recruiters_rejection_is_delivered_the_same_way(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    job = await a_published_job(recruiter)
    signup = await a_signed_in_candidate(other_browser, mailbox, "applicant")
    await give_a_current_cv(db_session, await my_id(other_browser))
    await a_saved_profile(other_browser, a_filled_profile())
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REJECTED)
    sender = CapturingSender()
    worker = a_communications_worker(database, sender)

    assert await worker.run_once() is True, "the confirmation"
    assert await worker.run_once() is False, "the rejection is not the sender's until its Telling"
    await the_telling_comes(db_session, application["id"])
    assert await worker.run_once() is True, "the rejection"

    _confirmation, rejection = await communications_of(db_session, application["id"])
    assert rejection.status is CommunicationStatus.SENT
    assert rejection.template_key == ApplicationRejection.template_key
    delivered = sender.sent[-1]
    assert delivered.to == signup.email
    assert job["title"] in delivered.subject
    assert "Amina Haddad" in delivered.text


async def _returned_to_the_queue(
    session: AsyncSession, communication_id: UUID, **changes: object
) -> None:
    """What the sweep leaves behind: queued again, with nothing of the last claim on it."""
    await _set(
        session,
        communication_id,
        status=CommunicationStatus.QUEUED,
        started_at=None,
        completed_at=None,
        available_at=None,
        **changes,
    )


async def _set(session: AsyncSession, communication_id: UUID, **changes: object) -> None:
    await session.execute(
        update(Communication).where(Communication.id == communication_id).values(**changes)
    )
    await session.commit()


async def _unconfirm(session: AsyncSession, email: str) -> None:
    await session.execute(
        text("update auth.users set email_confirmed_at = null where email = :email").bindparams(
            email=email
        )
    )
    await session.commit()
