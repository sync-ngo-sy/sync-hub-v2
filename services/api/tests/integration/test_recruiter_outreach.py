from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core import Database
from sync_core.communications import RecruiterMessage
from sync_core.models import CommunicationStatus, CommunicationType
from tests.support.applications import an_accepted_application, communications_of
from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.messaging import (
    MESSAGE_TEMPLATE_NOT_FOUND,
    VALIDATION_ERROR,
    a_saved_template,
    a_sent_message,
    read_template,
    send_message,
)
from tests.support.profiles import (
    a_filled_profile,
    a_saved_profile,
    give_a_current_cv,
    my_id,
)
from tests.support.senders import CapturingSender
from tests.support.worker import a_communications_worker

if TYPE_CHECKING:
    from sync_core.models import Communication

AN_EDIT: Final[dict[str, str]] = {
    "subject": "Could we meet on Tuesday?",
    "body": "Hi Amina,\n\nTuesday at ten, at our office?\n\nAcme",
}


@dataclass(frozen=True, slots=True)
class Applicant:
    """One Candidate who applied to one of the Tenant's Jobs, and how to reach them."""

    application: dict[str, Any]
    email: str
    job_title: str


async def an_applicant(
    recruiter: AsyncClient, browser: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> Applicant:
    job = await a_published_job(recruiter)
    signup = await a_signed_in_candidate(browser, mailbox, "applicant")
    await give_a_current_cv(session, await my_id(browser))
    await a_saved_profile(browser, a_filled_profile())
    return Applicant(
        application=await an_accepted_application(browser, job["id"]),
        email=signup.email,
        job_title=job["title"],
    )


async def _the_message(session: AsyncSession, application_id: str) -> Communication:
    _confirmation, message = await communications_of(session, application_id)
    return message


async def test_the_message_the_applicant_is_sent_has_every_placeholder_resolved(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    sent = await a_sent_message(recruiter, applicant.application["id"], template["id"])

    assert sent["subject"] == f"An interview for {applicant.job_title}?"
    assert sent["body"] == ("Hi Amina Haddad,\n\nWe would like to meet you.\n\nAcme Recruiting")
    assert sent["status"] == CommunicationStatus.QUEUED
    assert "{{" not in sent["subject"] + sent["body"]


async def test_the_communication_row_audits_the_resolved_words_and_who_sent_them(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    sent = await a_sent_message(recruiter, applicant.application["id"], template["id"])

    row = await _the_message(db_session, applicant.application["id"])
    assert str(row.id) == sent["id"]
    assert row.communication_type is CommunicationType.RECRUITER_MESSAGE
    assert row.template_key == RecruiterMessage.template_key
    assert row.initiated_by_recruiter_id is not None
    assert row.application_id is not None
    assert row.payload["subject"] == sent["subject"]
    assert row.payload["body"] == sent["body"]
    assert row.payload["template_name"] == template["name"]


async def test_the_captured_email_carries_the_resolved_values(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    """The whole point, end to end: create a template, send from it, run the sender once."""
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)
    await a_sent_message(recruiter, applicant.application["id"], template["id"])
    sender = CapturingSender()
    worker = a_communications_worker(database, sender)

    assert await worker.run_once() is True, "the application confirmation"
    assert await worker.run_once() is True, "the recruiter's message"

    delivered = sender.sent[-1]
    assert delivered.to == applicant.email
    assert delivered.subject == f"An interview for {applicant.job_title}?"
    assert "Hi Amina Haddad," in delivered.text
    assert "Acme Recruiting" in delivered.text
    assert "<p>Hi Amina Haddad,</p>" in delivered.html
    assert "{{" not in delivered.html

    row = await _the_message(db_session, applicant.application["id"])
    assert row.status is CommunicationStatus.SENT
    assert row.sent_at is not None
    assert row.subject == delivered.subject


async def test_the_same_template_sent_twice_is_two_messages(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    first = await a_sent_message(recruiter, applicant.application["id"], template["id"])
    second = await a_sent_message(recruiter, applicant.application["id"], template["id"])

    assert first["id"] != second["id"]
    sender = CapturingSender()
    worker = a_communications_worker(database, sender)
    while await worker.run_once():
        pass
    assert len(sender.sent) == 3, "the confirmation, and the message twice"


async def test_a_template_deleted_afterwards_leaves_the_sent_words_untouched(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)
    sent = await a_sent_message(recruiter, applicant.application["id"], template["id"])

    gone = await recruiter.delete(f"/v1/tenants/me/message-templates/{template['id']}")

    assert gone.status_code == 204, gone.text
    row = await _the_message(db_session, applicant.application["id"])
    assert row.payload["body"] == sent["body"]
    assert row.status is CommunicationStatus.QUEUED, "still deliverable, and still auditable"


async def test_a_send_may_bring_its_own_words_instead_of_the_templates(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    sent = await a_sent_message(recruiter, applicant.application["id"], template["id"], AN_EDIT)

    assert sent["subject"] == AN_EDIT["subject"]
    assert sent["body"] == AN_EDIT["body"]
    row = await _the_message(db_session, applicant.application["id"])
    assert row.payload["subject"] == AN_EDIT["subject"]
    assert row.payload["template_name"] == template["name"], "still sent from this template"


async def test_the_template_is_untouched_however_often_an_edited_send_goes(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    await a_sent_message(recruiter, applicant.application["id"], template["id"], AN_EDIT)
    await a_sent_message(
        recruiter,
        applicant.application["id"],
        template["id"],
        {"subject": "Wednesday then?", "body": "Wednesday works for us too."},
    )

    saved = await read_template(recruiter, template["id"])
    assert saved.json()["subject"] == template["subject"]
    assert saved.json()["body"] == template["body"]


async def test_a_placeholder_an_edited_send_writes_resolves_like_the_templates_own(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    sent = await a_sent_message(
        recruiter,
        applicant.application["id"],
        template["id"],
        {
            "subject": "{{ job_title }}, on Tuesday?",
            "body": "Hi {{ candidate_name }},\n\nTuesday?\n\n{{ tenant_name }}",
        },
    )

    assert sent["subject"] == f"{applicant.job_title}, on Tuesday?"
    assert sent["body"] == "Hi Amina Haddad,\n\nTuesday?\n\nAcme Recruiting"


@pytest.mark.parametrize("field", ["subject", "body"])
async def test_an_edited_send_cannot_name_a_placeholder_no_send_could_fill(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    field: str,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    refused = await send_message(
        recruiter,
        applicant.application["id"],
        template["id"],
        {**AN_EDIT, field: f"Hello {{{{ salary }}}} — {AN_EDIT[field]}"},
    )

    assert refused.status_code == 422, refused.text
    problem = refused.json()
    assert problem["type"] == VALIDATION_ERROR
    assert [error["location"] for error in problem["errors"]] == [f"body.edited.{field}"]
    assert len(await communications_of(db_session, applicant.application["id"])) == 1


async def test_another_tenants_applicant_cannot_be_written_to(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    theirs = await a_saved_template(rival)

    refused = await send_message(rival, applicant.application["id"], theirs["id"])

    assert refused.status_code == 404, refused.text
    assert len(await communications_of(db_session, applicant.application["id"])) == 1


async def test_another_tenants_template_cannot_be_sent_from(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    applicant = await an_applicant(recruiter, other_browser, mailbox, db_session)
    theirs = await a_saved_template(rival)

    refused = await send_message(recruiter, applicant.application["id"], theirs["id"])

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == MESSAGE_TEMPLATE_NOT_FOUND
    assert len(await communications_of(db_session, applicant.application["id"])) == 1


async def test_an_application_that_never_existed_is_a_404(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_applicant(recruiter, other_browser, mailbox, db_session)
    template = await a_saved_template(recruiter)

    refused = await send_message(recruiter, uuid4(), template["id"])

    assert refused.status_code == 404, refused.text
