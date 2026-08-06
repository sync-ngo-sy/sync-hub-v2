from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from sync_core.models import CvParsingStatus
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
    await db_session.execute(ASK, AN_ASK)
    await db_session.commit()

    with pytest.raises(IntegrityError, match="one_pending_per_email"):
        await db_session.execute(ASK, {**AN_ASK, "email": "AMINA@Acme.Example"})
    await db_session.rollback()


async def test_a_cv_cannot_be_ready_with_nothing_parsed(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
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
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    with pytest.raises(IntegrityError, match="jobs_description_length"):
        await db_session.execute(
            text("update jobs set description = :long where id = :id"),
            {"long": "x" * 5001, "id": job["id"]},
        )
    await db_session.rollback()


async def test_a_chunk_cannot_exist_without_an_embedding(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """A chunk with no vector is invisible to search and still satisfied the gate that decided
    whether its Candidate was searchable at all."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await db_session.execute(text("insert into embedding_models (model) values ('a-model')"))

    with pytest.raises(IntegrityError, match="embedding"):
        await db_session.execute(
            text(
                "insert into candidate_profile_chunks "
                "(candidate_id, chunk_text, chunk_index, embedding_model) "
                "values (:id, 'anything', 0, 'a-model')"
            ),
            {"id": candidate_id},
        )
    await db_session.rollback()


async def test_the_corpus_holds_one_embedding_model_at_a_time(db_session: AsyncSession) -> None:
    """Distances are only comparable within one model, and the index ranks them all together."""
    await db_session.execute(text("insert into embedding_models (model) values ('first-model')"))

    with pytest.raises(IntegrityError, match="embedding_models_holds_one_model"):
        await db_session.execute(
            text("insert into embedding_models (model) values ('second-model')")
        )
    await db_session.rollback()


async def test_a_chunk_cannot_name_a_model_the_corpus_has_not_established(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)

    with pytest.raises(IntegrityError, match="embedding_model"):
        await db_session.execute(
            text(
                "insert into candidate_profile_chunks "
                "(candidate_id, chunk_text, chunk_index, embedding, embedding_model) "
                "values (:id, 'anything', 0, array_fill(0.0::real, array[768])::vector, 'nobodys')"
            ),
            {"id": candidate_id},
        )
    await db_session.rollback()


async def test_a_candidate_whose_cv_was_never_read_cannot_become_searchable(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """`candidates_searchable_needs_cv` only asks that a CV exists, which a failed parse
    satisfies — so they would be told they were discoverable and appear nowhere."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id, parsing_status=CvParsingStatus.UPLOADED)

    with pytest.raises(IntegrityError, match="current CV has not been read"):
        await db_session.execute(
            text("update candidates set is_searchable = true where id = :id"), {"id": candidate_id}
        )
    await db_session.rollback()


async def test_correcting_a_candidates_name_enqueues_a_re_embed(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """A name lives on `profiles`, and it is the first line of the identity chunk."""
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await db_session.execute(
        text("update candidate_embedding_jobs set dirty = false where candidate_id = :id"),
        {"id": candidate_id},
    )
    await db_session.commit()

    await db_session.execute(
        text("update profiles set full_name = 'Amina Haddād' where id = :id"), {"id": candidate_id}
    )
    await db_session.commit()

    dirty = await db_session.scalar(
        text("select dirty from candidate_embedding_jobs where candidate_id = :id"),
        {"id": candidate_id},
    )
    assert dirty is True


async def test_renaming_a_recruiter_enqueues_nothing(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """A recruiter has no profile to embed, and `candidate_embedding_jobs` has no row to key
    against them — so the trigger firing at all would be a foreign key violation."""
    await an_admin(browser, mailbox)

    await db_session.execute(
        text(
            "update profiles set full_name = 'Rana Khalil' "
            "where account_type = 'recruiter'::account_type"
        )
    )
    await db_session.commit()

    queued = await db_session.scalar(text("select count(*) from candidate_embedding_jobs"))
    assert queued == 0
