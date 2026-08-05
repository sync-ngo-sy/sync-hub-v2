from __future__ import annotations

import asyncio
from typing import Any
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.applications.screening import SCREENING_VERSION
from sync_core.communications import ApplicationConfirmation, payload_of
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
    a_candidate_who_can_apply,
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
    AN_EDUCATION,
    AN_EXPERIENCE,
    a_filled_profile,
    a_saved_profile,
    give_a_current_cv,
    make_no_cv_current,
    my_id,
    my_profile,
    save_profile,
)


async def test_a_candidate_applies_and_sees_it_in_their_applications(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"])

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
    cv_id = await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"])

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
    assert verdict.screening_version == SCREENING_VERSION


async def test_the_snapshot_is_copied_from_the_live_profile(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"])

    snapshot = await snapshot_of(db_session, application["id"])
    assert snapshot.profile is not None
    assert snapshot.profile.headline == "Backend engineer, 8 years"
    assert snapshot.profile.full_name == "Amina Haddad"
    assert [row.job_title for row in snapshot.experiences] == ["Senior Engineer"]
    assert [row.institution for row in snapshot.educations] == ["Damascus University"]
    assert [row.name for row in snapshot.projects] == ["Ledger"]
    assert [row.language_code for row in snapshot.languages] == ["ar", "en"]
    assert [float(row.years_experience) for row in snapshot.skills] == [8.0, 6.0]


async def test_a_profile_in_the_request_is_not_what_gets_snapshotted(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The whole point of the change: no way to apply with data the profile does not hold."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(
        other_browser,
        job["id"],
        profile=a_filled_profile(headline="Principal engineer, 20 years"),
        cv_id=str(uuid4()),
        update_profile=True,
    )

    snapshot = await snapshot_of(db_session, application["id"])
    assert snapshot.profile is not None
    assert snapshot.profile.headline == "Backend engineer, 8 years"


async def test_the_snapshot_carries_the_unmapped_skills_and_screening_never_saw_them(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Python", "importance": "required", "minimum_years": 3}]
    )
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, unmapped_skills=["Kubernetes wrangling", "Bash"]
    )

    application = await an_accepted_application(other_browser, job["id"])

    snapshot = await snapshot_of(db_session, application["id"])
    assert snapshot.profile is not None
    assert snapshot.profile.unmapped_skills == ["Kubernetes wrangling", "Bash"]
    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.QUALIFIED


async def test_the_confirmation_is_queued_in_the_same_transaction(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"])

    [confirmation] = await communications_of(db_session, application["id"])
    assert confirmation.status is CommunicationStatus.QUEUED
    assert confirmation.sent_at is None
    assert confirmation.tenant_id is not None
    payload = payload_of(confirmation.payload)
    assert isinstance(payload, ApplicationConfirmation)
    assert payload.job_title == job["title"]
    assert payload.candidate_name == "Amina Haddad"


async def test_the_answers_are_stored_against_their_questions(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION, A_SHORT_TEXT_QUESTION])
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    yes_no, short_text = questions_of(job)

    application = await an_accepted_application(
        other_browser,
        job["id"],
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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    refused = await apply_to(other_browser, draft["id"])

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:job-not-found"


async def test_applying_without_a_current_cv_is_refused(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await make_no_cv_current(db_session, await my_id(other_browser))

    refused = await apply_to(other_browser, job["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:no-current-cv"


async def test_the_cv_is_the_current_one_and_the_request_cannot_name_another(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    swapped = await give_a_current_cv(db_session, await my_id(other_browser))

    application = await an_accepted_application(other_browser, job["id"])

    assert (await stored_application(db_session, application["id"])).cv_id == swapped


async def test_how_far_the_parse_got_is_not_a_submit_precondition(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Only `current_cv_id` being set is checked. Whether that CV has been read is not."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await give_a_current_cv(
        db_session, await my_id(other_browser), parsing_status=CvParsingStatus.PROCESSING
    )

    accepted = await apply_to(other_browser, job["id"])

    assert accepted.status_code == 201, accepted.text


async def test_applying_with_no_skills_is_refused_and_says_so(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    await a_saved_profile(other_browser, a_filled_profile(skills=[]))

    refused = await apply_to(other_browser, job["id"])

    assert refused.status_code == 422, refused.text
    problem = refused.json()
    assert problem["type"] == "urn:sync:problem:incomplete-profile"
    assert "at least one skill" in problem["detail"]


async def test_applying_with_neither_a_job_nor_a_qualification_is_refused_and_says_so(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    await a_saved_profile(other_browser, a_filled_profile(experiences=[], educations=[]))

    refused = await apply_to(other_browser, job["id"])

    assert refused.status_code == 422, refused.text
    assert "either a job or a qualification" in refused.json()["detail"]


async def test_either_a_job_or_a_qualification_is_enough(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)
    await a_saved_profile(
        other_browser, a_filled_profile(experiences=[], educations=[AN_EDUCATION])
    )
    only_educated = await apply_to(other_browser, job["id"])
    assert only_educated.status_code == 201, only_educated.text

    await a_saved_profile(
        other_browser, a_filled_profile(experiences=[AN_EXPERIENCE], educations=[])
    )
    elsewhere = await a_published_job(recruiter)

    only_employed = await apply_to(other_browser, elsewhere["id"])

    assert only_employed.status_code == 201, only_employed.text


async def test_an_empty_profile_is_refused_before_anything_is_written(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_ready_cv(other_browser, mailbox, db_session)

    refused = await apply_to(other_browser, job["id"])

    assert refused.status_code == 422, refused.text
    assert await applications_of(db_session, await my_id(other_browser)) == []
    assert await my_applications(other_browser) == []


async def test_a_save_racing_a_submission_cannot_snapshot_a_profile_nobody_judged(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Both take the candidate row's lock, so the two cannot interleave into an Application whose
    Snapshot is thinner than the profile the preconditions passed."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    emptying, applying = await asyncio.gather(
        save_profile(other_browser, a_filled_profile(skills=[], experiences=[], educations=[])),
        apply_to(other_browser, job["id"]),
    )

    assert emptying.status_code == 200, emptying.text
    if applying.status_code == 201:
        snapshot = await snapshot_of(db_session, applying.json()["id"])
        assert snapshot.skills, "an Application was snapshotted from an emptied profile"
    else:
        assert applying.status_code == 422, applying.text
        assert applying.json()["type"] == "urn:sync:problem:incomplete-profile"


async def test_every_required_question_has_to_be_answered(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION, A_SHORT_TEXT_QUESTION])
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    yes_no, _short_text = questions_of(job)

    refused = await apply_to(
        other_browser,
        job["id"],
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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    [yes_no] = questions_of(job)

    refused = await apply_to(
        other_browser,
        job["id"],
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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    [somebody_elses_question] = questions_of(elsewhere)

    refused = await apply_to(
        other_browser,
        job["id"],
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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"])

    assert await answers_of(db_session, application["id"]) == []


async def test_applying_twice_answers_with_the_application_already_there(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    first = await an_accepted_application(other_browser, job["id"])

    refused = await apply_to(other_browser, job["id"])

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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    withdrawn = await withdraw(other_browser, application["id"])
    assert withdrawn.status_code == 200, withdrawn.text

    refused = await apply_to(other_browser, job["id"])

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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"])

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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    [knockout] = questions_of(job)

    application = await an_accepted_application(
        other_browser,
        job["id"],
        answers=[{"question_id": knockout["id"], "answer_boolean": False}],
    )

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.DISQUALIFIED


async def test_a_new_application_never_carries_unknown_years(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Years are required at save, so `review_required` on unknown years is unreachable here."""
    job = await a_job_screening_on(
        recruiter,
        skills=[{"name": "Python", "importance": "required", "minimum_years": 5}],
    )
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)

    application = await an_accepted_application(other_browser, job["id"])

    snapshot = await snapshot_of(db_session, application["id"])
    assert all(row.years_experience is not None for row in snapshot.skills)
    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.QUALIFIED


async def test_an_application_is_attributed_to_the_link_that_brought_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    landed = await follow_link(other_browser, link["token"])
    assert landed.status_code == 200, landed.text

    application = await an_accepted_application(other_browser, job["id"])

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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    assert (await read_public_job(other_browser, job["id"])).status_code == 200

    application = await an_accepted_application(other_browser, job["id"])

    stored = await stored_application(db_session, application["id"])
    assert stored.tracked_link_id is None


async def test_applying_leaves_the_live_profile_exactly_as_it_was(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Submission reads the profile and writes nothing back to it."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    before = await my_profile(other_browser)

    await an_accepted_application(other_browser, job["id"])

    assert await my_profile(other_browser) == before


async def test_the_applications_list_says_where_each_one_stands_and_no_more(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"])

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
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(browser, mailbox, db_session, "stranger")

    assert await my_applications(browser) == []


async def test_applying_is_only_for_candidates(
    recruiter: AsyncClient, other_browser: AsyncClient
) -> None:
    job = await a_published_job(recruiter)

    assert (await apply_to(other_browser, job["id"])).status_code == 401
    refused = await apply_to(recruiter, job["id"])
    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == "urn:sync:problem:candidate-only"


async def test_the_first_application_freezes_what_the_job_screens_on(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"])

    refused = await set_criteria(
        recruiter, job["id"], skills=[{"name": "Python", "importance": "required"}]
    )

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:job-criteria-locked"


A_DECADE_OF_WORK: list[dict[str, Any]] = [
    {
        "job_title": "Engineer",
        "company_name": "Globex",
        "start_year": 2015,
        "start_month": 1,
        "end_year": 2024,
        "end_month": 12,
        "is_current": False,
        "description": None,
    }
]


async def test_an_application_freezes_the_total_experience_the_profile_had(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, experiences=A_DECADE_OF_WORK
    )

    application = await an_accepted_application(other_browser, job["id"])

    snapshot = await snapshot_of(db_session, application["id"])
    assert snapshot.profile is not None
    assert snapshot.profile.total_experience_years == 10


async def test_a_profile_saved_after_applying_does_not_move_a_frozen_total(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Copied, not recomputed: the Application carries the number as it stood that day."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, experiences=A_DECADE_OF_WORK
    )
    application = await an_accepted_application(other_browser, job["id"])

    await a_saved_profile(other_browser, a_filled_profile(experiences=[AN_EXPERIENCE]))

    snapshot = await snapshot_of(db_session, application["id"])
    assert snapshot.profile is not None
    assert snapshot.profile.total_experience_years == 10


async def test_too_little_experience_is_refused_citing_the_frozen_number(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_job_screening_on(recruiter, minimum_total_experience_years=10.0)
    await a_candidate_who_can_apply(
        other_browser,
        mailbox,
        db_session,
        experiences=[{**A_DECADE_OF_WORK[0], "start_year": 2023, "end_year": 2024}],
    )

    application = await an_accepted_application(other_browser, job["id"])

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.DISQUALIFIED
    assert stored.qualification_reason is not None
    assert "10.0 years of work" in stored.qualification_reason
    assert "has 2" in stored.qualification_reason


async def test_work_the_snapshot_counts_clears_the_bar(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_job_screening_on(recruiter, minimum_total_experience_years=5.0)
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, experiences=A_DECADE_OF_WORK
    )

    application = await an_accepted_application(other_browser, job["id"])

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.QUALIFIED
