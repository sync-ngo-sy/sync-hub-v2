from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from seed.history import STAGE_VALUES
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from sync_core.models import ApplicationStatus, CvParsingStatus
from sync_core.stages import stage_of
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


async def test_a_stage_change_notification_cannot_name_no_application(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_whole_application(recruiter, other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)

    with pytest.raises(IntegrityError, match="notifications_stage_change_has_an_application"):
        await db_session.execute(
            text(
                "insert into notifications (recipient_profile_id, type, payload) values "
                "(:id, 'application_stage_changed', "
                '\'{"type": "application_stage_changed"}\'::jsonb)'
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


A_PHONE = text("update profiles set phone = :phone, phone_country = :country where id = :id")


@pytest.mark.parametrize(
    "number", ["0963115550134", "963115550134", "+963 11 555 0134", "+0115550134", "reach me"]
)
async def test_a_number_that_is_not_e164_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, number: str
) -> None:
    """Spaces and a leading zero included: one stored shape is what lets two readers agree."""
    await a_signed_in_candidate(browser, mailbox)

    with pytest.raises(IntegrityError, match="profiles_phone_is_e164"):
        await db_session.execute(
            A_PHONE, {"phone": number, "country": "SY", "id": await my_id(browser)}
        )
    await db_session.rollback()


@pytest.mark.parametrize("country", ["sy", "SYR", "S1", "Syria"])
async def test_a_country_that_is_not_an_iso_code_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, country: str
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    with pytest.raises(IntegrityError, match="profiles_phone_country_is_iso"):
        await db_session.execute(
            A_PHONE, {"phone": "+963115550134", "country": country, "id": await my_id(browser)}
        )
    await db_session.rollback()


@pytest.mark.parametrize(("phone", "country"), [("+963115550134", None), (None, "SY")])
async def test_a_number_and_its_country_are_stored_together_or_not_at_all(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    phone: str | None,
    country: str | None,
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    with pytest.raises(IntegrityError, match="profiles_phone_has_a_country"):
        await db_session.execute(
            A_PHONE, {"phone": phone, "country": country, "id": await my_id(browser)}
        )
    await db_session.rollback()


A_FROZEN_PHONE = text(
    "insert into application_profile_snapshots "
    "(application_id, full_name, phone, phone_country, total_experience_years) "
    "values (gen_random_uuid(), 'Amina Haddad', :phone, :country, 0)"
)


@pytest.mark.parametrize(
    ("phone", "country", "refused"),
    [
        ("+963 11 555 0134", "SY", "asnap_phone_is_e164"),
        ("+963115550134", "sy", "asnap_phone_country_is_iso"),
        ("+963115550134", None, "asnap_phone_has_a_country"),
        (None, "SY", "asnap_phone_has_a_country"),
    ],
)
async def test_a_snapshot_freezes_a_phone_the_live_table_would_have_held(
    db_session: AsyncSession, phone: str | None, country: str | None, refused: str
) -> None:
    """An Application is read for years after it arrived. A frozen Phone the live table would
    refuse is one nobody could read back."""
    with pytest.raises(IntegrityError, match=refused):
        await db_session.execute(A_FROZEN_PHONE, {"phone": phone, "country": country})
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


MARK_COMPLETE = text("update candidates set profile_completed_at = now() where id = :id")

FILL_THE_ROWS_OWN_FIELDS = text(
    "update candidates set headline = 'Open to work', summary = 'Ships boring things.', "
    "location_key = 'sy-damascus', canonical_role_key = 'backend-engineer' where id = :id"
)


async def test_a_completion_marker_needs_the_fields_the_candidate_row_itself_holds(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    with pytest.raises(IntegrityError, match="candidates_completed_profile_is_filled_in"):
        await db_session.execute(MARK_COMPLETE, {"id": await my_id(browser)})
    await db_session.rollback()


async def test_the_service_role_cannot_mark_a_profile_complete_that_is_not(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)
    await db_session.execute(FILL_THE_ROWS_OWN_FIELDS, {"id": candidate_id})

    await db_session.execute(MARK_COMPLETE, {"id": candidate_id})

    with pytest.raises(IntegrityError, match="is not complete"):
        await db_session.commit()
    await db_session.rollback()


async def test_global_search_cannot_be_switched_on_without_the_marker(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    candidate_id = await my_id(browser)
    await give_a_current_cv(db_session, candidate_id)

    with pytest.raises(IntegrityError, match="candidates_searchable_needs_a_complete_profile"):
        await db_session.execute(
            text("update candidates set is_searchable = true where id = :id"), {"id": candidate_id}
        )
    await db_session.rollback()


async def test_the_seeds_sql_projection_agrees_with_the_one_the_platform_uses(
    db_session: AsyncSession,
) -> None:
    """`seed/history.py` restates the Stage projection in SQL to back-date Notifications.

    Read in Postgres rather than in Python, because a VALUES list that Python builds correctly
    and Postgres reads differently is exactly the drift this guards.
    """
    projected = await db_session.execute(
        text(f"select status, stage from (values {STAGE_VALUES}) as stages (status, stage)")
    )

    assert dict(projected.tuples().all()) == {
        status.value: stage_of(status).value for status in ApplicationStatus
    }


A_READING = text(
    "insert into application_ai_match_assessments "
    "(application_id, match_percentage, explanation, model_name, prompt_version) "
    "values (:id, :percentage, :explanation, 'a-model', 'v-test') returning id"
)


async def test_a_reading_repoints_the_application_whoever_wrote_it(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The pointer is the database's job, not the backend's — the worker and a Recruiter's own
    request both land as an ordinary insert, and neither has to remember to aim it."""
    application = await a_whole_application(recruiter, other_browser, mailbox, db_session)

    reading = await db_session.scalar(
        A_READING, {"id": application["id"], "percentage": 61.5, "explanation": "The first read."}
    )
    later = await db_session.scalar(
        A_READING, {"id": application["id"], "percentage": 72.0, "explanation": "A second read."}
    )

    pointed = (
        await db_session.execute(
            text(
                "select current_match_assessment_id, current_match_score "
                "from applications where id = :id"
            ),
            {"id": application["id"]},
        )
    ).one()
    assert pointed == (later, 72.00)
    assert reading != later, "asking again appends rather than replacing"
    await db_session.rollback()


async def test_throwing_the_current_reading_away_falls_back_to_the_one_before_it(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application = await a_whole_application(recruiter, other_browser, mailbox, db_session)
    first = await db_session.scalar(
        A_READING, {"id": application["id"], "percentage": 61.5, "explanation": "The first read."}
    )
    second = await db_session.scalar(
        A_READING, {"id": application["id"], "percentage": 72.0, "explanation": "A second read."}
    )

    await db_session.execute(
        text("delete from application_ai_match_assessments where id = :id"), {"id": second}
    )

    pointed = (
        await db_session.execute(
            text(
                "select current_match_assessment_id, current_match_score "
                "from applications where id = :id"
            ),
            {"id": application["id"]},
        )
    ).one()
    assert pointed == (first, 61.50)
    await db_session.rollback()


async def test_an_application_cannot_point_at_another_applications_reading(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The Current assessment is composite-keyed, so "current" can only mean one of its own."""
    application = await a_whole_application(recruiter, other_browser, mailbox, db_session)
    somebody_elses = await db_session.scalar(
        A_READING, {"id": application["id"], "percentage": 61.5, "explanation": "Not yours."}
    )
    other = await a_whole_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(IntegrityError, match="applications_current_match_assessment_fk"):
        await db_session.execute(
            text(
                "update applications set current_match_assessment_id = :reading, "
                "current_match_score = 61.5 where id = :id"
            ),
            {"reading": somebody_elses, "id": other["id"]},
        )
    await db_session.rollback()


async def test_a_match_score_cannot_stand_without_the_reading_that_explains_it(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application = await a_whole_application(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(IntegrityError, match="applications_current_match_is_whole"):
        await db_session.execute(
            text("update applications set current_match_score = 90 where id = :id"),
            {"id": application["id"]},
        )
    await db_session.rollback()
