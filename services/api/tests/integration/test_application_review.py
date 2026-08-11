from __future__ import annotations

from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.communications import ApplicationRejection, payload_of
from sync_core.models import (
    ApplicationStatus,
    CommunicationStatus,
    CommunicationType,
    QualificationStatus,
    StatusChangeSource,
)
from tests.support.applications import (
    A_SHORT_TEXT_QUESTION,
    A_YES_NO_QUESTION,
    a_candidate_who_can_apply,
    a_candidate_with_a_stored_cv,
    a_job_screening_on,
    a_moved_application,
    a_reviewed_application,
    a_withdrawn_application,
    an_accepted_application,
    an_applicant_with_a_stored_cv,
    apply_to,
    communications_of,
    job_applications_of,
    list_job_applications,
    move_to,
    my_applications,
    qualification_history_of,
    questions_of,
    read_application,
    status_history_of,
    stored_application,
    withdraw,
)
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.notifications import my_notifications
from tests.support.profiles import a_filled_profile, a_saved_profile
from tests.support.tenants import an_admin


async def test_the_job_lists_who_applied_and_where_each_one_stands(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    [listed] = await job_applications_of(recruiter, job["id"])

    assert listed["id"] == application["id"]
    assert listed["candidate_name"] == "Amina Haddad"
    assert listed["headline"] == "Backend engineer, 8 years"
    assert listed["status"] == "new"
    assert listed["qualification_status"] == "qualified"


async def test_the_application_list_filters_by_status_and_by_verdict(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, skills=[{"name": "Rust", "years_experience": 4.0}]
    )
    qualified = await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    rejected = await an_accepted_application(third_browser, job["id"])
    await a_moved_application(recruiter, rejected["id"], ApplicationStatus.REJECTED)

    by_status = await job_applications_of(recruiter, job["id"], status="rejected")
    by_verdict = await job_applications_of(recruiter, job["id"], qualification_status="qualified")

    assert [item["id"] for item in by_status] == [rejected["id"]]
    assert [item["id"] for item in by_verdict] == [qualified["id"]]


async def test_the_application_list_takes_several_statuses_at_once(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    shortlisted = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, shortlisted["id"], ApplicationStatus.SHORTLISTED)
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    rejected = await an_accepted_application(third_browser, job["id"])
    await a_moved_application(recruiter, rejected["id"], ApplicationStatus.REJECTED)

    both = await job_applications_of(recruiter, job["id"], status=["shortlisted", "rejected"])
    neither = await job_applications_of(recruiter, job["id"], status=["new", "hired"])

    assert {item["id"] for item in both} == {shortlisted["id"], rejected["id"]}
    assert neither == []


async def test_the_application_list_counts_every_status_whatever_it_is_filtered_to(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    still_new = await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    rejected = await an_accepted_application(third_browser, job["id"])
    await a_moved_application(recruiter, rejected["id"], ApplicationStatus.REJECTED)

    page = await list_job_applications(recruiter, job["id"], status="new")
    assert page.status_code == 200, page.text
    counts = {one["status"]: one["count"] for one in page.json()["status_counts"]}

    assert [item["id"] for item in page.json()["items"]] == [still_new["id"]]
    assert counts == {
        "new": 1,
        "reviewing": 0,
        "shortlisted": 0,
        "interview": 0,
        "offer": 0,
        "hired": 0,
        "rejected": 1,
        "withdrawn": 0,
    }


async def test_the_verdict_filter_narrows_the_status_counts_as_well_as_the_list(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, skills=[{"name": "Rust", "years_experience": 4.0}]
    )
    await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    await an_accepted_application(third_browser, job["id"])

    page = await list_job_applications(recruiter, job["id"], qualification_status="qualified")
    assert page.status_code == 200, page.text
    counts = {one["status"]: one["count"] for one in page.json()["status_counts"]}

    assert counts["new"] == 1


async def test_the_application_list_takes_several_verdicts_at_once(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, skills=[{"name": "Rust", "years_experience": 4.0}]
    )
    qualified = await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    disqualified = await an_accepted_application(third_browser, job["id"])

    both = await job_applications_of(
        recruiter, job["id"], qualification_status=["qualified", "disqualified"]
    )
    neither = await job_applications_of(
        recruiter, job["id"], qualification_status=["pending", "review_required"]
    )

    assert {item["id"] for item in both} == {qualified["id"], disqualified["id"]}
    assert neither == []


async def test_the_application_list_counts_every_verdict_whatever_it_is_filtered_to(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, skills=[{"name": "Rust", "years_experience": 4.0}]
    )
    qualified = await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    await an_accepted_application(third_browser, job["id"])

    page = await list_job_applications(recruiter, job["id"], qualification_status="qualified")
    assert page.status_code == 200, page.text
    counts = {one["verdict"]: one["count"] for one in page.json()["verdict_counts"]}

    assert [item["id"] for item in page.json()["items"]] == [qualified["id"]]
    assert counts == {"pending": 0, "qualified": 1, "disqualified": 1, "review_required": 0}


async def test_the_status_filter_narrows_the_verdict_counts_as_well_as_the_list(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    await a_candidate_who_can_apply(
        other_browser, mailbox, db_session, skills=[{"name": "Rust", "years_experience": 4.0}]
    )
    await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    disqualified = await an_accepted_application(third_browser, job["id"])
    await a_moved_application(recruiter, disqualified["id"], ApplicationStatus.REJECTED)

    page = await list_job_applications(recruiter, job["id"], status="new")
    assert page.status_code == 200, page.text
    counts = {one["verdict"]: one["count"] for one in page.json()["verdict_counts"]}

    assert counts["qualified"] == 1
    assert counts["disqualified"] == 0


async def test_the_application_list_pages_newest_first(
    recruiter: AsyncClient,
    third_browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    first = await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "stranger")
    second = await an_accepted_application(third_browser, job["id"])

    page = await list_job_applications(recruiter, job["id"], limit=1)
    assert page.status_code == 200, page.text
    newest = page.json()
    following = await job_applications_of(
        recruiter, job["id"], limit=1, cursor=newest["next_cursor"]
    )

    assert [item["id"] for item in newest["items"]] == [second["id"]]
    assert [item["id"] for item in following] == [first["id"]]


async def test_another_tenants_job_has_no_applications_to_read(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"])
    await an_admin(browser, mailbox, "rival")

    refused = await list_job_applications(browser, job["id"])

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:job-not-found"


async def test_the_review_holds_the_snapshot_the_answers_and_the_verdict(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(recruiter, questions=[A_YES_NO_QUESTION, A_SHORT_TEXT_QUESTION])
    await a_candidate_with_a_stored_cv(other_browser, mailbox, db_session)
    yes_no, short_text = questions_of(job)
    application = await an_accepted_application(
        other_browser,
        job["id"],
        answers=[
            {"question_id": yes_no["id"], "answer_boolean": True},
            {"question_id": short_text["id"], "answer_text": "In two weeks."},
        ],
    )

    review = await a_reviewed_application(recruiter, application["id"])

    assert review["job"]["title"] == job["title"]
    assert review["status"] == "new"
    assert review["screening"]["status"] == "qualified"
    snapshot = review["snapshot"]
    assert snapshot["full_name"] == "Amina Haddad"
    assert snapshot["headline"] == "Backend engineer, 8 years"
    assert [entry["job_title"] for entry in snapshot["experiences"]] == ["Senior Engineer"]
    assert [entry["institution"] for entry in snapshot["educations"]] == ["Damascus University"]
    assert [entry["name"] for entry in snapshot["skills"]] == ["Python", "PostgreSQL"]
    assert [entry["code"] for entry in snapshot["languages"]] == ["ar", "en"]
    assert [entry["name"] for entry in snapshot["projects"]] == ["Ledger"]
    assert [
        (entry["question_text"], entry["answer_boolean"], entry["answer_text"])
        for entry in review["answers"]
    ] == [
        (yes_no["question_text"], True, None),
        (short_text["question_text"], None, "In two weeks."),
    ]


async def test_the_review_carries_the_two_live_facts_a_snapshot_never_froze(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    applicant = await an_applicant_with_a_stored_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    review = await a_reviewed_application(recruiter, application["id"])

    assert review["candidate"]["id"] == str(applicant.id)
    assert review["candidate"]["email"] == applicant.signup.email
    assert "email" not in review["snapshot"]
    assert "canonical_role_name" not in review["candidate"]


async def test_the_snapshot_freezes_the_role_they_applied_as_not_the_one_they_hold_now(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await an_applicant_with_a_stored_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    await a_saved_profile(other_browser, a_filled_profile(canonical_role_key="data-scientist"))

    review = await a_reviewed_application(recruiter, application["id"])

    assert review["snapshot"]["canonical_role"] == "Backend Engineer"


async def test_the_review_says_why_the_verdict_went_the_way_it_did(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": 3}]
    )
    await a_candidate_with_a_stored_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    review = await a_reviewed_application(recruiter, application["id"])

    assert review["screening"]["status"] == "disqualified"
    assert "Rust" in review["screening"]["reason"]


async def test_the_review_links_the_cv_the_candidate_applied_with(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    web: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    cv_id = await a_candidate_with_a_stored_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    review = await a_reviewed_application(recruiter, application["id"])

    assert review["cv"]["id"] == str(cv_id)
    assert review["cv"]["expires_in_seconds"] > 0
    fetched = await web.get(review["cv"]["download_url"])
    assert fetched.status_code == 200, fetched.text
    assert fetched.content.startswith(b"%PDF")


async def test_the_review_carries_the_whole_status_history(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_with_a_stored_cv(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)

    review = await a_reviewed_application(recruiter, application["id"])

    assert [
        (entry["previous_status"], entry["status"], entry["source"]) for entry in review["history"]
    ] == [
        (None, "new", "candidate"),
        ("new", "reviewing", "recruiter"),
    ]


async def test_another_tenants_application_is_the_same_404(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await an_admin(browser, mailbox, "rival")

    unknown = await read_application(browser, uuid4())
    somebody_elses = await read_application(browser, application["id"])

    assert unknown.status_code == 404, unknown.text
    assert somebody_elses.status_code == 404, somebody_elses.text
    assert somebody_elses.json()["type"] == unknown.json()["type"]


async def test_reviewing_is_only_for_recruiters(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    refused = await read_application(other_browser, application["id"])

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == "urn:sync:problem:recruiter-only"


async def test_a_recruiter_moves_an_application_through_the_pipeline_and_back(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    for status in (
        ApplicationStatus.REVIEWING,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.OFFER,
    ):
        moved = await a_moved_application(recruiter, application["id"], status)
        assert moved["status"] == status.value

    assert moved["previous_status"] == "shortlisted"
    stored = await stored_application(db_session, application["id"])
    assert stored.status is ApplicationStatus.OFFER
    assert [
        entry.new_status for entry in await status_history_of(db_session, application["id"])
    ] == [
        ApplicationStatus.NEW,
        ApplicationStatus.REVIEWING,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.OFFER,
    ]


async def test_every_move_names_the_recruiter_who_made_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)

    _submission, move = await status_history_of(db_session, application["id"])

    assert move.change_source is StatusChangeSource.RECRUITER
    assert move.changed_by_profile_id is not None


async def test_a_recruiter_may_take_an_application_back_to_where_it_started(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """`new` is a state like any other undecided one: free movement includes going back to it."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)

    back = await a_moved_application(recruiter, application["id"], ApplicationStatus.NEW)

    assert back["status"] == "new"
    assert back["previous_status"] == "reviewing"


async def test_a_hired_application_is_the_end_of_the_line(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.HIRED)

    refused = await move_to(recruiter, application["id"], ApplicationStatus.REVIEWING)

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:application-transition-not-allowed"
    stored = await stored_application(db_session, application["id"])
    assert stored.status is ApplicationStatus.HIRED


async def test_a_rejection_can_only_be_undone_back_to_reviewing(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REJECTED)

    refused = await move_to(recruiter, application["id"], ApplicationStatus.SHORTLISTED)
    undone = await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)

    assert refused.status_code == 409, refused.text
    assert undone["status"] == "reviewing"


async def test_a_recruiter_cannot_withdraw_on_the_candidates_behalf(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    refused = await move_to(recruiter, application["id"], ApplicationStatus.WITHDRAWN)

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:application-transition-not-allowed"


async def test_a_move_to_where_it_already_is_changes_nothing(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    refused = await move_to(recruiter, application["id"], ApplicationStatus.NEW)

    assert refused.status_code == 409, refused.text
    assert len(await status_history_of(db_session, application["id"])) == 1


async def test_moving_is_only_for_recruiters_of_the_tenant(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await an_admin(browser, mailbox, "rival")

    by_the_candidate = await move_to(other_browser, application["id"], ApplicationStatus.REVIEWING)
    by_a_rival = await move_to(browser, application["id"], ApplicationStatus.REVIEWING)

    assert by_the_candidate.status_code == 403, by_the_candidate.text
    assert by_a_rival.status_code == 404, by_a_rival.text


async def test_every_move_reaches_the_candidates_bell(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)
    await a_moved_application(recruiter, application["id"], ApplicationStatus.SHORTLISTED)

    [newest, older] = await my_notifications(other_browser)

    assert newest["payload"]["type"] == "application_status_changed"
    assert newest["payload"]["status"] == "shortlisted"
    assert newest["payload"]["previous_status"] == "reviewing"
    assert newest["payload"]["application_id"] == application["id"]
    assert newest["payload"]["job_title"] == job["title"]
    assert newest["payload"]["tenant_name"]
    assert older["payload"]["status"] == "reviewing"


async def test_a_move_that_is_refused_tells_the_candidate_nothing(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.HIRED)

    await move_to(recruiter, application["id"], ApplicationStatus.OFFER)

    assert [item["payload"]["status"] for item in await my_notifications(other_browser)] == [
        "hired"
    ]


async def test_a_rejection_a_human_decided_also_queues_the_email(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    await a_moved_application(recruiter, application["id"], ApplicationStatus.REJECTED)

    confirmation, rejection = await communications_of(db_session, application["id"])
    assert confirmation.communication_type is CommunicationType.APPLICATION_CONFIRMATION
    assert rejection.communication_type is CommunicationType.APPLICATION_REJECTION
    assert rejection.status is CommunicationStatus.QUEUED
    assert rejection.tenant_id is not None
    payload = payload_of(rejection.payload)
    assert isinstance(payload, ApplicationRejection)
    assert payload.job_title == job["title"]
    assert payload.candidate_name == "Amina Haddad"
    assert [item["payload"]["status"] for item in await my_notifications(other_browser)] == [
        "rejected"
    ]


async def test_only_a_rejection_is_worth_an_email(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)
    await a_moved_application(recruiter, application["id"], ApplicationStatus.HIRED)

    [confirmation] = await communications_of(db_session, application["id"])
    assert confirmation.communication_type is CommunicationType.APPLICATION_CONFIRMATION


async def test_a_second_rejection_is_a_second_email(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Undoing a rejection and deciding it again is two decisions, and the Candidate hears both."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    await a_moved_application(recruiter, application["id"], ApplicationStatus.REJECTED)
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REJECTED)

    rejections = [
        row
        for row in await communications_of(db_session, application["id"])
        if row.communication_type is CommunicationType.APPLICATION_REJECTION
    ]
    assert len(rejections) == 2
    assert len({row.idempotency_key for row in rejections}) == 2


async def test_no_status_change_ever_touches_the_verdict(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_job_screening_on(
        recruiter, skills=[{"name": "Rust", "importance": "required", "minimum_years": None}]
    )
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)
    await a_moved_application(recruiter, application["id"], ApplicationStatus.HIRED)

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.DISQUALIFIED
    assert stored.qualification_reason is not None
    assert len(await qualification_history_of(db_session, application["id"])) == 1


async def test_a_candidate_withdraws_and_the_job_is_closed_to_them_for_good(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    withdrawn = await a_withdrawn_application(other_browser, application["id"])

    assert withdrawn["status"] == "withdrawn"
    assert withdrawn["previous_status"] == "new"
    assert withdrawn["changed_at"]
    assert [item["status"] for item in await my_applications(other_browser)] == ["withdrawn"]
    refused = await apply_to(other_browser, job["id"])
    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:duplicate-application"
    assert refused.json()["application_id"] == application["id"]


async def test_withdrawing_is_final_for_everyone(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_withdrawn_application(other_browser, application["id"])

    again = await withdraw(other_browser, application["id"])
    by_the_recruiter = await move_to(recruiter, application["id"], ApplicationStatus.REVIEWING)

    assert again.status_code == 409, again.text
    assert by_the_recruiter.status_code == 409, by_the_recruiter.text
    assert len(await status_history_of(db_session, application["id"])) == 2


async def test_a_decided_application_can_no_longer_be_withdrawn(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_moved_application(recruiter, application["id"], ApplicationStatus.HIRED)

    refused = await withdraw(other_browser, application["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:application-transition-not-allowed"


async def test_the_withdrawal_is_recorded_as_the_candidates_own(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    await a_withdrawn_application(other_browser, application["id"])

    _submission, withdrawal = await status_history_of(db_session, application["id"])
    assert withdrawal.new_status is ApplicationStatus.WITHDRAWN
    assert withdrawal.change_source is StatusChangeSource.CANDIDATE
    assert [item["payload"]["status"] for item in await my_notifications(other_browser)] == [
        "withdrawn"
    ]
    [confirmation] = await communications_of(db_session, application["id"])
    assert confirmation.communication_type is CommunicationType.APPLICATION_CONFIRMATION


async def test_nobody_withdraws_somebody_elses_application(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])
    await a_candidate_who_can_apply(browser, mailbox, db_session, "stranger")

    somebody_elses = await withdraw(browser, application["id"])
    unknown = await withdraw(browser, uuid4())

    assert somebody_elses.status_code == 404, somebody_elses.text
    assert unknown.status_code == 404, unknown.text
    assert somebody_elses.json()["type"] == unknown.json()["type"]
