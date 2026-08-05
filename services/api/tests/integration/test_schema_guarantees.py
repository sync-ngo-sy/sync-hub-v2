"""What the schema refuses on its own, whoever is asking.

Companions to `test_immutable_history.py`: those are the triggers, these are the constraints.
Written as raw SQL rather than through the API, deliberately — the API refuses most of this
already, and the point is that the floor holds when a script, a migration or a future endpoint
goes around the front door. Every one of them stood for a state the platform never produces and
could not have explained if it found one.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from tests.support.applications import a_whole_application
from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import a_created_job
from tests.support.profiles import give_a_current_cv, my_id
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox

AN_ASK = {
    "company": "Acme Recruiting",
    "full_name": "Amina Haddad",
    "email": "amina@acme.example",
}

ASK = text(
    "insert into access_requests (company, full_name, email) values (:company, :full_name, :email)"
)


async def test_an_access_request_with_a_blank_company_is_refused(
    db_session: AsyncSession,
) -> None:
    """`not null` is no guard against a stranger: a space is a value, and the company is what the
    Tenant gets called on conversion."""
    with pytest.raises(IntegrityError, match="access_requests_company_not_blank"):
        await db_session.execute(ASK, {**AN_ASK, "company": "   "})
    await db_session.rollback()


async def test_an_access_request_with_a_blank_name_is_refused(db_session: AsyncSession) -> None:
    with pytest.raises(IntegrityError, match="access_requests_full_name_not_blank"):
        await db_session.execute(ASK, {**AN_ASK, "full_name": ""})
    await db_session.rollback()


@pytest.mark.parametrize("address", ["  ", "amina", "amina@acme", "amina @acme.example"])
async def test_an_access_request_with_a_malformed_address_is_refused(
    db_session: AsyncSession, address: str
) -> None:
    with pytest.raises(IntegrityError, match="access_requests_email_shape"):
        await db_session.execute(ASK, {**AN_ASK, "email": address})
    await db_session.rollback()


async def test_one_address_holds_one_pending_request_whatever_its_case(
    db_session: AsyncSession,
) -> None:
    """An address is the same address however it is typed, and an operator working this queue
    must not see one company waiting twice."""
    await db_session.execute(ASK, AN_ASK)
    await db_session.commit()

    with pytest.raises(IntegrityError, match="one_pending_per_email"):
        await db_session.execute(ASK, {**AN_ASK, "email": "AMINA@Acme.Example"})
    await db_session.rollback()


async def test_a_cv_cannot_be_ready_with_nothing_parsed(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """`ready` is what makes a CV appliable and searchable. One marked ready with no parse is a
    Candidate whose CV the platform claims to have read and has not."""
    await a_signed_in_candidate(browser, mailbox)
    cv_id = await give_a_current_cv(db_session, await my_id(browser))

    with pytest.raises(IntegrityError, match="cvs_ready_has_a_parse"):
        await db_session.execute(
            text("update cvs set parsed_cv_data = null, parsed_at = null where id = :id"),
            {"id": cv_id},
        )
    await db_session.rollback()


async def test_a_cv_cannot_have_failed_without_saying_why(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    cv_id = await give_a_current_cv(db_session, await my_id(browser))

    with pytest.raises(IntegrityError, match="cvs_failure_has_a_reason"):
        await db_session.execute(
            text(
                "update cvs set parsing_status = 'failed', parsing_error = null, "
                "parsed_cv_data = null, parsed_at = null where id = :id"
            ),
            {"id": cv_id},
        )
    await db_session.rollback()


async def test_a_cv_cannot_be_written_in_a_language_the_platform_has_no_code_for(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The column sits beside a table holding exactly these codes, and now references it."""
    await a_signed_in_candidate(browser, mailbox)
    cv_id = await give_a_current_cv(db_session, await my_id(browser))

    with pytest.raises(IntegrityError, match="cvs_detected_language_fk"):
        await db_session.execute(
            text("update cvs set detected_language = 'arabic' where id = :id"), {"id": cv_id}
        )
    await db_session.rollback()


async def test_a_human_decision_cannot_be_recorded_with_no_author(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """An audit trail that cannot name who moved an Application is not one. `system` is the only
    source with nobody behind it."""
    application = await a_whole_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(IntegrityError, match="ash_human_decision_has_an_author"):
        await db_session.execute(
            text(
                "insert into application_status_history "
                "(application_id, change_source, new_status) values (:id, 'recruiter', 'reviewing')"
            ),
            {"id": application["id"]},
        )
    await db_session.rollback()


async def test_a_refusal_cannot_be_recorded_without_saying_what_refused(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application = await a_whole_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(IntegrityError, match="applications_disqualification_has_a_reason"):
        await db_session.execute(
            text(
                "update applications set qualification_status = 'disqualified', "
                "qualification_reason = null where id = :id"
            ),
            {"id": application["id"]},
        )
    await db_session.rollback()


async def test_the_history_of_a_refusal_cannot_forget_the_reason_either(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application = await a_whole_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(IntegrityError, match="aqh_disqualification_has_a_reason"):
        await db_session.execute(
            text(
                "insert into application_qualification_history "
                "(application_id, qualification_status) values (:id, 'disqualified')"
            ),
            {"id": application["id"]},
        )
    await db_session.rollback()


async def test_a_status_change_notification_cannot_name_no_application(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """`application_id` is what every reader of this table joins and filters on, and a move is a
    move *of an Application*. It stays nullable for the CV notification, which is about a CV."""
    await a_whole_application(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)

    with pytest.raises(IntegrityError, match="notifications_status_change_has_an_application"):
        await db_session.execute(
            text(
                "insert into notifications (recipient_profile_id, type, payload) values "
                "(:id, 'application_status_changed', "
                '\'{"type": "application_status_changed"}\'::jsonb)'
            ),
            {"id": candidate_id},
        )
    await db_session.rollback()


async def test_a_job_description_too_long_for_a_search_vector_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """A tsvector raises past about a megabyte rather than truncating, so an unbounded column
    here made "save this job" a 500 waiting to happen. The API's own cap is the number."""
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    with pytest.raises(IntegrityError, match="jobs_description_length"):
        await db_session.execute(
            text("update jobs set description = :long where id = :id"),
            {"long": "x" * 5001, "id": job["id"]},
        )
    await db_session.rollback()
