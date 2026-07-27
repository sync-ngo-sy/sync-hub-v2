from __future__ import annotations

from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import (
    TENANT_JOBS,
    a_created_job,
    a_job,
    an_application,
    change_job,
    post_job,
    read_job,
    set_criteria,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id
from tests.support.tenants import a_teammate, an_admin

A_KNOCKOUT_QUESTION: dict[str, Any] = {
    "question_text": "Are you legally allowed to work in Syria?",
    "question_type": "yes_no",
    "is_required": True,
    "accepted_boolean_answer": True,
}

AN_OPEN_QUESTION: dict[str, Any] = {
    "question_text": "What is the largest system you have run?",
    "question_type": "short_text",
    "is_required": False,
    "accepted_boolean_answer": None,
}

DEMANDING = {
    "minimum_total_experience_years": 5.0,
    "skills": [
        {"name": "Python", "importance": "required", "minimum_years": 3},
        {"name": "PostgreSQL", "importance": "preferred", "minimum_years": None},
    ],
    "languages": [{"code": "en", "minimum_proficiency": "advanced"}],
    "questions": [A_KNOCKOUT_QUESTION, AN_OPEN_QUESTION],
}


async def test_a_new_job_is_a_draft_with_no_criteria(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    job = await a_created_job(browser)

    assert job["status"] == "draft"
    assert job["title"] == "Senior Backend Engineer"
    assert job["location"] == "Damascus, Syria"
    assert job["criteria"] == {
        "minimum_total_experience_years": None,
        "skills": [],
        "languages": [],
        "questions": [],
    }
    assert job["criteria_locked"] is False


async def test_a_job_reads_back_the_same_out_of_the_list_and_on_its_own(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    listed = await browser.get(TENANT_JOBS)

    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()["items"]] == [job["id"]]
    assert (await read_job(browser, job["id"]))["title"] == job["title"]


async def test_any_active_recruiter_of_the_tenant_may_run_a_colleagues_job(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await a_teammate(browser, other_browser, mailbox)

    edited = await change_job(other_browser, job["id"], title="Staff Backend Engineer")

    assert edited.status_code == 200, edited.text
    assert (await read_job(browser, job["id"]))["title"] == "Staff Backend Engineer"


async def test_another_tenants_job_might_as_well_not_exist(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox, "acme")
    job = await a_created_job(browser)
    await an_admin(other_browser, mailbox, "globex")

    assert (await other_browser.get(f"{TENANT_JOBS}/{job['id']}")).status_code == 404
    assert (await change_job(other_browser, job["id"], title="Ours now")).status_code == 404
    assert (await other_browser.get(TENANT_JOBS)).json()["items"] == []


async def test_a_candidate_has_no_jobs_to_run(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await post_job(browser)

    assert response.status_code == 403, response.text
    assert response.json()["type"] == "urn:sync:problem:recruiter-only"


async def test_jobs_are_not_managed_without_a_session(browser: AsyncClient) -> None:
    assert (await browser.get(TENANT_JOBS)).status_code == 401
    assert (await post_job(browser)).status_code == 401


async def test_a_deactivated_recruiter_cannot_run_jobs(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    teammate = await a_teammate(browser, other_browser, mailbox)
    await browser.patch(f"/v1/tenants/me/members/{teammate['id']}", json={"is_active": False})

    response = await post_job(other_browser)

    assert response.status_code == 403, response.text


async def test_a_job_moves_through_its_lifecycle(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    for status in ("published", "closed", "published", "archived"):
        moved = await change_job(browser, job["id"], status=status)
        assert moved.status_code == 200, moved.text
        assert moved.json()["status"] == status


async def test_a_job_cannot_skip_from_draft_to_closed(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    refused = await change_job(browser, job["id"], status="closed")

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:job-transition-not-allowed"
    assert (await read_job(browser, job["id"]))["status"] == "draft"


async def test_an_archived_job_is_archived_for_good(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await change_job(browser, job["id"], status="archived")

    refused = await change_job(browser, job["id"], status="published")

    assert refused.status_code == 409, refused.text
    assert (await read_job(browser, job["id"]))["status"] == "archived"


async def test_restating_the_status_a_job_already_has_changes_nothing(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    unchanged = await change_job(browser, job["id"], status="draft", title="Backend Engineer")

    assert unchanged.status_code == 200, unchanged.text
    assert unchanged.json()["title"] == "Backend Engineer"


async def test_the_list_is_newest_first_and_pages_by_cursor(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    oldest = await a_created_job(browser, title="Oldest")
    middle = await a_created_job(browser, title="Middle")
    newest = await a_created_job(browser, title="Newest")

    first_page = await browser.get(TENANT_JOBS, params={"limit": 2})
    body = first_page.json()
    assert [item["id"] for item in body["items"]] == [newest["id"], middle["id"]]
    assert body["next_cursor"] is not None

    second_page = await browser.get(TENANT_JOBS, params={"limit": 2, "cursor": body["next_cursor"]})
    rest = second_page.json()
    assert [item["id"] for item in rest["items"]] == [oldest["id"]]
    assert rest["next_cursor"] is None


async def test_the_list_can_be_narrowed_to_one_status(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    draft = await a_created_job(browser, title="Still being written")
    published = await a_created_job(browser)
    await change_job(browser, published["id"], status="published")

    listed = await browser.get(TENANT_JOBS, params={"status": "draft"})

    assert [item["id"] for item in listed.json()["items"]] == [draft["id"]]


async def test_criteria_are_replaced_whole(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    saved = await set_criteria(browser, job["id"], **DEMANDING)

    assert saved.status_code == 200, saved.text
    criteria = (await read_job(browser, job["id"]))["criteria"]
    assert criteria["minimum_total_experience_years"] == 5.0
    assert [(skill["name"], skill["importance"]) for skill in criteria["skills"]] == [
        ("PostgreSQL", "preferred"),
        ("Python", "required"),
    ]
    assert criteria["languages"] == [{"code": "en", "minimum_proficiency": "advanced"}]
    assert [question["question_text"] for question in criteria["questions"]] == [
        A_KNOCKOUT_QUESTION["question_text"],
        AN_OPEN_QUESTION["question_text"],
    ]
    assert criteria["questions"][0]["accepted_boolean_answer"] is True


async def test_emptied_criteria_leave_nothing_behind(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await set_criteria(browser, job["id"], **DEMANDING)

    emptied = await set_criteria(browser, job["id"])

    assert emptied.status_code == 200, emptied.text
    assert (await read_job(browser, job["id"]))["criteria"] == {
        "minimum_total_experience_years": None,
        "skills": [],
        "languages": [],
        "questions": [],
    }


async def test_a_skill_that_is_not_canonical_is_refused_by_name(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    refused = await set_criteria(
        browser,
        job["id"],
        skills=[{"name": "Vibe coding", "importance": "required", "minimum_years": None}],
    )

    assert refused.status_code == 422, refused.text
    assert refused.json()["type"] == "urn:sync:problem:unknown-canonical-skill"
    assert "Vibe coding" in refused.json()["errors"][0]["message"]


async def test_a_language_the_platform_does_not_know_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    refused = await set_criteria(
        browser, job["id"], languages=[{"code": "zz", "minimum_proficiency": "fluent"}]
    )

    assert refused.status_code == 422, refused.text
    assert refused.json()["type"] == "urn:sync:problem:unknown-language"


async def test_only_a_yes_no_question_can_carry_the_answer_that_passes(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    refused = await set_criteria(
        browser,
        job["id"],
        questions=[{**AN_OPEN_QUESTION, "accepted_boolean_answer": True}],
    )

    assert refused.status_code == 422, refused.text


async def test_the_same_skill_named_twice_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    refused = await set_criteria(
        browser,
        job["id"],
        skills=[
            {"name": "Python", "importance": "required", "minimum_years": None},
            {"name": "Python", "importance": "preferred", "minimum_years": 2},
        ],
    )

    assert refused.status_code == 422, refused.text


async def test_criteria_lock_the_moment_the_first_application_arrives(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await set_criteria(browser, job["id"], **DEMANDING)
    await a_signed_in_candidate(other_browser, mailbox)
    await an_application(db_session, job["id"], await my_id(other_browser))

    refused = await set_criteria(browser, job["id"])

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:job-criteria-locked"
    assert len((await read_job(browser, job["id"]))["criteria"]["skills"]) == 2
    assert (await read_job(browser, job["id"]))["criteria_locked"] is True


async def test_the_prose_stays_editable_after_an_application_arrives(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await set_criteria(browser, job["id"], **DEMANDING)
    await a_signed_in_candidate(other_browser, mailbox)
    await an_application(db_session, job["id"], await my_id(other_browser))

    edited = await change_job(
        browser,
        job["id"],
        title="Senior Backend Engineer (payments)",
        description="Now with a typo fixed.",
        location="Aleppo, Syria",
        status="published",
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Senior Backend Engineer (payments)"
    assert edited.json()["location"] == "Aleppo, Syria"
    assert edited.json()["status"] == "published"
    assert edited.json()["updated_at"] > job["updated_at"]


async def test_a_job_with_no_title_is_refused_before_it_reaches_the_database(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    response = await post_job(browser, a_job(title="   "))

    assert response.status_code == 422, response.text
