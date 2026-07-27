from __future__ import annotations

from typing import Any
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.communications import payload_of
from sync_core.models import (
    ApplicationStatus,
    CommunicationStatus,
    CvParsingStatus,
    QualificationStatus,
    StatusChangeSource,
)
from tests.support.applications import (
    A_SHORT_TEXT_QUESTION,
    A_YES_NO_QUESTION,
    a_candidate_with_a_ready_cv,
    a_job_screening_on,
    an_accepted_application,
    answers_of,
    applications_of,
    apply_to,
    communications_of,
    my_applications,
    qualification_history_of,
    questions_of,
    snapshot_of,
    status_history_of,
    stored_application,
    withdraw,
)
from tests.support.jobs import (
    a_created_job,
    a_published_job,
    a_tracked_link,
    follow_link,
    read_public_job,
    set_criteria,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import (
    a_profile,
    embedding_jobs,
    give_a_current_cv,
    my_id,
    my_profile,
)

A_REVIEWED_PROFILE: dict[str, Any] = a_profile(
    headline="Backend engineer, 8 years",
    summary="Builds boring systems that stay up.",
    location="Damascus, Syria",
    experiences=[
        {
            "job_title": "Senior Engineer",
            "company_name": "Acme",
            "start_year": 2018,
            "start_month": 1,
            "end_year": None,
            "end_month": None,
            "is_current": True,
            "description": None,
        }
    ],
    educations=[
        {
            "institution": "Damascus University",
            "degree": "BSc",
            "field_of_study": "Computer Science",
            "graduation_year": 2017,
            "description": None,
        }
    ],
    skills=[
        {"name": "Python", "years_experience": 8.0},
        {"name": "PostgreSQL", "years_experience": 6.0},
    ],
    languages=[
        {"code": "ar", "proficiency": "native"},
        {"code": "en", "proficiency": "fluent"},
    ],
    projects=[
        {
            "name": "Ledger",
            "description": None,
            "project_url": None,
            "repository_url": None,
            "start_year": 2022,
            "start_month": 3,
            "end_year": None,
            "end_month": None,
        }
    ],
)


async def test_a_candidate_applies_and_sees_it_in_their_applications(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"], cv_id)

    assert application["job"]["id"] == job["id"]
    assert application["job"]["title"] == job["title"]
    assert application["status"] == "new"
    assert [item["id"] for item in await my_applications(other_browser)] == [application["id"]]


async def test_one_submission_writes_the_whole_application(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    application = await an_accepted_application(
        other_browser, job["id"], cv_id, profile=A_REVIEWED_PROFILE
    )

    stored = await stored_application(db_session, application["id"])
    assert stored.status is ApplicationStatus.NEW
    assert stored.qualification_status is QualificationStatus.QUALIFIED
    assert stored.cv_id == cv_id
    [history] = await status_history_of(db_session, application["id"])
    assert history.new_status is ApplicationStatus.NEW
    assert history.previous_status is None
    assert history.change_source is StatusChangeSource.CANDIDATE
    [verdict] = await qualification_history_of(db_session, application["id"])
    assert verdict.qualification_status is QualificationStatus.QUALIFIED
    assert verdict.screening_version == "1"


async def test_the_snapshot_is_the_reviewed_data_and_the_candidates_own_name(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    application = await an_accepted_application(
        other_browser, job["id"], cv_id, profile=A_REVIEWED_PROFILE
    )

    snapshot = await snapshot_of(db_session, application["id"])
    assert snapshot.profile is not None
    assert snapshot.profile.headline == "Backend engineer, 8 years"
    assert snapshot.profile.full_name == "Amina Haddad"
    assert [row.job_title for row in snapshot.experiences] == ["Senior Engineer"]
    assert [row.institution for row in snapshot.educations] == ["Damascus University"]
    assert [row.name for row in snapshot.projects] == ["Ledger"]
    assert [row.language_code for row in snapshot.languages] == ["ar", "en"]
    assert len(snapshot.skills) == 2


async def test_the_confirmation_is_queued_in_the_same_transaction(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"], cv_id)

    [confirmation] = await communications_of(db_session, application["id"])
    assert confirmation.status is CommunicationStatus.QUEUED
    assert confirmation.sent_at is None
    assert confirmation.tenant_id is not None
    payload = payload_of(confirmation.payload)
    assert payload.job_title == job["title"]
    assert payload.candidate_name == "Amina Haddad"


async def test_the_answers_are_stored_against_their_questions(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION, A_SHORT_TEXT_QUESTION])
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    yes_no, short_text = questions_of(job)

    application = await an_accepted_application(
        other_browser,
        job["id"],
        cv_id,
        answers=[
            {"question_id": yes_no["id"], "answer_boolean": True},
            {"question_id": short_text["id"], "answer_text": "In two weeks."},
        ],
    )

    answers = {
        str(row.question_id): (row.answer_boolean, row.answer_text)
        for row in await answers_of(db_session, application["id"])
    }
    assert answers == {
        yes_no["id"]: (True, None),
        short_text["id"]: (None, "In two weeks."),
    }


async def test_a_job_nobody_can_read_is_a_job_nobody_can_apply_to(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    draft = await a_created_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    refused = await apply_to(other_browser, draft["id"], cv_id)

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:job-not-found"


async def test_applying_with_a_cv_that_is_not_yours_is_refused(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    someone_elses = await a_candidate_with_a_ready_cv(browser, mailbox, db_session, "stranger")
    await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    refused = await apply_to(other_browser, job["id"], someone_elses)

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:cv-not-found"


async def test_applying_with_a_cv_that_is_still_being_read_is_refused(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    unready = await give_a_current_cv(
        db_session, await my_id(other_browser), parsing_status=CvParsingStatus.PROCESSING
    )

    refused = await apply_to(other_browser, job["id"], unready)

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:cv-not-ready"


async def test_every_required_question_has_to_be_answered(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION, A_SHORT_TEXT_QUESTION])
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    yes_no, _short_text = questions_of(job)

    refused = await apply_to(
        other_browser,
        job["id"],
        cv_id,
        answers=[{"question_id": yes_no["id"], "answer_boolean": True}],
    )

    assert refused.status_code == 422, refused.text
    problem = refused.json()
    assert problem["type"] == "urn:sync:problem:invalid-application-answers"
    assert [error["type"] for error in problem["errors"]] == ["missing_required_answer"]
    assert "When could you start?" in problem["errors"][0]["message"]


async def test_an_answer_of_the_wrong_kind_is_refused(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION])
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    [yes_no] = questions_of(job)

    refused = await apply_to(
        other_browser,
        job["id"],
        cv_id,
        answers=[{"question_id": yes_no["id"], "answer_text": "Yes, I do."}],
    )

    assert refused.status_code == 422, refused.text
    problem = refused.json()
    assert [error["type"] for error in problem["errors"]] == ["answer_type_mismatch"]
    assert problem["errors"][0]["location"] == "body.answers.0.answer_boolean"


async def test_an_answer_to_another_jobs_question_is_refused(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    elsewhere = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION])
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    [somebody_elses_question] = questions_of(elsewhere)

    refused = await apply_to(
        other_browser,
        job["id"],
        cv_id,
        answers=[{"question_id": somebody_elses_question["id"], "answer_boolean": True}],
    )

    assert refused.status_code == 422, refused.text
    assert [error["type"] for error in refused.json()["errors"]] == ["unknown_question"]


async def test_an_optional_question_may_go_unanswered(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, questions=[{**A_SHORT_TEXT_QUESTION, "is_required": False}]
    )
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"], cv_id)

    assert await answers_of(db_session, application["id"]) == []


async def test_a_skill_the_platform_does_not_know_is_refused_where_it_was_typed(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    refused = await apply_to(
        other_browser,
        job["id"],
        cv_id,
        profile=a_profile(skills=[{"name": "Telepathy", "years_experience": 3.0}]),
    )

    assert refused.status_code == 422, refused.text
    problem = refused.json()
    assert problem["type"] == "urn:sync:problem:unknown-canonical-skill"
    assert problem["errors"][0]["location"] == "body.profile.skills.0.name"


async def test_a_refused_submission_leaves_nothing_behind(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The searchable check runs inside the transaction, after the Application is written."""
    job = await a_published_job(recruiter)
    ready = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    await give_a_current_cv(db_session, candidate_id, parsing_status=CvParsingStatus.PROCESSING)

    refused = await apply_to(
        other_browser,
        job["id"],
        ready,
        profile=a_profile(is_searchable=True),
        update_profile=True,
    )

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:searchable-needs-cv"
    assert await applications_of(db_session, candidate_id) == []
    assert await my_applications(other_browser) == []


async def test_applying_twice_answers_with_the_application_already_there(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    first = await an_accepted_application(other_browser, job["id"], cv_id)

    refused = await apply_to(other_browser, job["id"], cv_id)

    assert refused.status_code == 409, refused.text
    problem = refused.json()
    assert problem["type"] == "urn:sync:problem:duplicate-application"
    assert problem["application_id"] == first["id"]
    assert len(await applications_of(db_session, await my_id(other_browser))) == 1


async def test_a_withdrawn_application_still_holds_its_job(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Withdrawal is final per job, and the uniqueness that makes it so is the schema's."""
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"], cv_id)
    withdrawn = await withdraw(other_browser, application["id"])
    assert withdrawn.status_code == 200, withdrawn.text

    refused = await apply_to(other_browser, job["id"], cv_id)

    assert refused.status_code == 409, refused.text
    assert refused.json()["application_id"] == application["id"]


async def test_the_verdict_is_written_with_the_application(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter,
        skills=[{"name": "Rust", "importance": "required", "minimum_years": 3}],
    )
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    application = await an_accepted_application(
        other_browser, job["id"], cv_id, profile=A_REVIEWED_PROFILE
    )

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.DISQUALIFIED
    assert stored.qualification_reason is not None
    assert "Rust" in stored.qualification_reason


async def test_a_knockout_answer_decides_the_verdict(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION])
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    [knockout] = questions_of(job)

    application = await an_accepted_application(
        other_browser,
        job["id"],
        cv_id,
        answers=[{"question_id": knockout["id"], "answer_boolean": False}],
    )

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.DISQUALIFIED


async def test_unstated_years_of_a_required_skill_send_it_to_a_human(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter,
        skills=[{"name": "Python", "importance": "required", "minimum_years": 5}],
    )
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    application = await an_accepted_application(
        other_browser,
        job["id"],
        cv_id,
        profile=a_profile(skills=[{"name": "Python", "years_experience": None}]),
    )

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.REVIEW_REQUIRED


async def test_an_application_is_attributed_to_the_link_that_brought_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    landed = await follow_link(other_browser, link["token"])
    assert landed.status_code == 200, landed.text

    application = await an_accepted_application(other_browser, job["id"], cv_id)

    stored = await stored_application(db_session, application["id"])
    assert str(stored.tracked_link_id) == link["id"]


async def test_an_applicant_who_found_the_job_themselves_is_attributed_to_nobody(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"])
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    assert (await read_public_job(other_browser, job["id"])).status_code == 200

    application = await an_accepted_application(other_browser, job["id"], cv_id)

    stored = await stored_application(db_session, application["id"])
    assert stored.tracked_link_id is None


async def test_one_review_can_improve_the_live_profile_too(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    await an_accepted_application(
        other_browser, job["id"], cv_id, profile=A_REVIEWED_PROFILE, update_profile=True
    )

    live = await my_profile(other_browser)
    assert live["headline"] == "Backend engineer, 8 years"
    assert [skill["name"] for skill in live["skills"]] == ["Python", "PostgreSQL"]
    assert len(await embedding_jobs(db_session, await my_id(other_browser))) == 1


async def test_the_live_profile_is_left_alone_unless_the_candidate_asked(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    await an_accepted_application(other_browser, job["id"], cv_id, profile=A_REVIEWED_PROFILE)

    live = await my_profile(other_browser)
    assert live["headline"] is None
    assert live["skills"] == []


async def test_the_applications_list_says_where_each_one_stands_and_no_more(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"], cv_id)

    [listed] = await my_applications(other_browser)

    assert listed["status"] == "new"
    assert listed["job"]["tenant"]["name"]
    assert "qualification_status" not in listed
    assert "qualification_reason" not in listed


async def test_another_candidates_applications_are_not_in_the_list(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    theirs = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"], theirs)
    await a_candidate_with_a_ready_cv(browser, mailbox, db_session, "stranger")

    assert await my_applications(browser) == []


async def test_applying_is_only_for_candidates(
    recruiter: AsyncClient, other_browser: AsyncClient
) -> None:
    job = await a_published_job(recruiter)
    cv_id = uuid4()

    assert (await apply_to(other_browser, job["id"], cv_id)).status_code == 401
    refused = await apply_to(recruiter, job["id"], cv_id)
    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == "urn:sync:problem:candidate-only"


async def test_the_first_application_freezes_what_the_job_screens_on(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"], cv_id)

    refused = await set_criteria(
        recruiter, job["id"], skills=[{"name": "Python", "importance": "required"}]
    )

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:job-criteria-locked"
