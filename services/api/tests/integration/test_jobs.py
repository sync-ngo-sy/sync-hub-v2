from __future__ import annotations

import asyncio
from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import JobSkill
from sync_core.profile import MAX_PARAGRAPH_LENGTH
from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import (
    TENANT_JOBS,
    a_closed_job,
    a_created_job,
    a_job,
    a_published_job,
    an_application,
    change_job,
    post_job,
    read_job,
    read_public_job,
    set_criteria,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id
from tests.support.stats import forget_when_it_went_live
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
    assert job["location_key"] == "sy-damascus"
    assert job["location_name"] == "Damascus"
    assert job["employment_type"] == "full_time"
    assert job["work_mode"] == "onsite"
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


async def test_a_description_too_long_to_index_is_a_validation_error(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    refused = await post_job(browser, a_job(description="x" * (MAX_PARAGRAPH_LENGTH + 1)))

    assert refused.status_code == 422, refused.text


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


async def test_two_status_changes_at_once_cannot_republish_an_archived_job(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    await a_teammate(browser, other_browser, mailbox)
    job = await a_closed_job(browser)

    archiving, publishing = await asyncio.gather(
        change_job(browser, job["id"], status="archived"),
        change_job(other_browser, job["id"], status="published"),
    )

    assert {archiving.status_code, publishing.status_code} <= {200, 409}
    settled = (await read_job(browser, job["id"]))["status"]
    assert settled == "archived", "an archived job came back published"


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


async def test_the_list_can_be_read_oldest_first(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)
    oldest = await a_created_job(browser, title="Oldest")
    middle = await a_created_job(browser, title="Middle")
    newest = await a_created_job(browser, title="Newest")

    first_page = await browser.get(TENANT_JOBS, params={"limit": 2, "sort": "oldest"})
    body = first_page.json()
    assert [item["id"] for item in body["items"]] == [oldest["id"], middle["id"]]

    rest = await browser.get(
        TENANT_JOBS, params={"limit": 2, "sort": "oldest", "cursor": body["next_cursor"]}
    )
    assert [item["id"] for item in rest.json()["items"]] == [newest["id"]]
    assert rest.json()["next_cursor"] is None


async def test_the_list_can_be_ordered_by_how_many_applications_arrived(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    busiest = await a_created_job(browser, title="Busiest")
    await a_created_job(browser, title="Quiet")
    await a_signed_in_candidate(other_browser, mailbox)
    await an_application(db_session, busiest["id"], await my_id(other_browser))

    listed = await browser.get(TENANT_JOBS, params={"sort": "applications"})

    assert listed.status_code == 200, listed.text
    assert [item["title"] for item in listed.json()["items"]] == ["Busiest", "Quiet"]
    assert [item["title"] for item in (await browser.get(TENANT_JOBS)).json()["items"]] == [
        "Quiet",
        "Busiest",
    ], "the busiest is the older of the two, so this order is not the default one"


async def test_the_busiest_first_order_pages_by_cursor(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    busiest = await a_created_job(browser, title="Busiest")
    await a_created_job(browser, title="Quiet and older")
    await a_created_job(browser, title="Quiet and newer")
    await a_signed_in_candidate(other_browser, mailbox)
    await an_application(db_session, busiest["id"], await my_id(other_browser))

    first_page = await browser.get(TENANT_JOBS, params={"limit": 2, "sort": "applications"})
    body = first_page.json()
    assert [item["title"] for item in body["items"]] == ["Busiest", "Quiet and newer"]

    rest = await browser.get(
        TENANT_JOBS, params={"limit": 2, "sort": "applications", "cursor": body["next_cursor"]}
    )
    assert [item["title"] for item in rest.json()["items"]] == ["Quiet and older"]
    assert rest.json()["next_cursor"] is None


async def test_a_cursor_from_one_order_is_not_a_cursor_for_another(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    await a_created_job(browser, title="One")
    await a_created_job(browser, title="Two")
    by_date = (await browser.get(TENANT_JOBS, params={"limit": 1})).json()["next_cursor"]
    oldest = (await browser.get(TENANT_JOBS, params={"limit": 1, "sort": "oldest"})).json()[
        "next_cursor"
    ]
    by_rank = (await browser.get(TENANT_JOBS, params={"limit": 1, "sort": "applications"})).json()[
        "next_cursor"
    ]

    refused = await browser.get(
        TENANT_JOBS, params={"limit": 1, "sort": "applications", "cursor": by_date}
    )
    refused_the_other_way = await browser.get(TENANT_JOBS, params={"limit": 1, "cursor": by_rank})
    refused_newest_as_oldest = await browser.get(
        TENANT_JOBS, params={"limit": 1, "sort": "oldest", "cursor": by_date}
    )
    refused_oldest_as_newest = await browser.get(TENANT_JOBS, params={"limit": 1, "cursor": oldest})

    assert refused.status_code == 422, refused.text
    assert refused_the_other_way.status_code == 422, refused_the_other_way.text
    assert refused_newest_as_oldest.status_code == 422, refused_newest_as_oldest.text
    assert refused_oldest_as_newest.status_code == 422, refused_oldest_as_newest.text


async def test_the_list_can_be_narrowed_to_one_status(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    draft = await a_created_job(browser, title="Still being written")
    published = await a_created_job(browser)
    await change_job(browser, published["id"], status="published")

    listed = await browser.get(TENANT_JOBS, params={"status": "draft"})

    assert [item["id"] for item in listed.json()["items"]] == [draft["id"]]


async def test_the_chosen_status_does_not_hide_what_the_other_statuses_hold(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    await a_created_job(browser, title="Draft role")
    published = await a_published_job(browser, title="Published role")
    await a_closed_job(browser, title="Closed role")
    archived = await a_created_job(browser, title="Archived role")
    await change_job(browser, archived["id"], status="archived")

    listed = await browser.get(TENANT_JOBS, params={"status": "published", "limit": 1})

    body = listed.json()
    assert [item["id"] for item in body["items"]] == [published["id"]]
    assert {one["status"]: one["count"] for one in body["status_counts"]} == {
        "draft": 1,
        "published": 1,
        "closed": 1,
        "archived": 1,
    }


async def test_a_search_narrows_the_status_counts_the_way_it_narrows_the_list(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    await a_created_job(browser, title="Draft role")
    await a_published_job(browser, title="Published role")
    await a_closed_job(browser, title="Closed role")

    listed = await browser.get(TENANT_JOBS, params={"q": "Published"})

    assert {one["status"]: one["count"] for one in listed.json()["status_counts"]} == {
        "draft": 0,
        "published": 1,
        "closed": 0,
        "archived": 0,
    }


async def test_the_list_can_be_narrowed_to_one_work_mode(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The same control the public board has, over the Tenant's own Jobs."""
    await an_admin(browser, mailbox)
    onsite = await a_created_job(browser, title="Onsite role")
    remote = await a_created_job(browser, title="Remote role", work_mode="remote")

    listed = await browser.get(TENANT_JOBS, params={"work_mode": "remote"})

    assert [item["id"] for item in listed.json()["items"]] == [remote["id"]]
    assert [item["id"] for item in (await browser.get(TENANT_JOBS)).json()["items"]] == [
        remote["id"],
        onsite["id"],
    ]


async def test_a_work_mode_narrows_the_status_counts_the_way_a_search_does(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    await a_created_job(browser, title="Draft role")
    await a_published_job(browser, title="Published role", work_mode="remote")
    await a_closed_job(browser, title="Closed role")

    listed = await browser.get(TENANT_JOBS, params={"work_mode": "remote"})

    assert {one["status"]: one["count"] for one in listed.json()["status_counts"]} == {
        "draft": 0,
        "published": 1,
        "closed": 0,
        "archived": 0,
    }


async def test_the_list_searches_job_titles_only_ignoring_case(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    matching = await a_created_job(browser, title="Data Analyst")
    await a_created_job(
        browser,
        title="Programme Officer",
        description="Works alongside the data analyst.",
    )

    listed = await browser.get(TENANT_JOBS, params={"q": "data analyst"})

    assert [item["id"] for item in listed.json()["items"]] == [matching["id"]]


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


async def test_the_lock_is_the_databases_own_and_not_the_backends_good_manners(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await set_criteria(browser, job["id"], **DEMANDING)
    await a_signed_in_candidate(other_browser, mailbox)
    await an_application(db_session, job["id"], await my_id(other_browser))

    with pytest.raises(IntegrityError):
        await db_session.execute(
            delete(JobSkill).where(JobSkill.job_id == UUID(job["id"])),
        )
    await db_session.rollback()


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
        location_key="sy-aleppo",
        status="published",
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["title"] == "Senior Backend Engineer (payments)"
    assert edited.json()["location_key"] == "sy-aleppo"
    assert edited.json()["location_name"] == "Aleppo"
    assert edited.json()["status"] == "published"
    assert edited.json()["updated_at"] > job["updated_at"]


async def test_a_job_with_no_title_is_refused_before_it_reaches_the_database(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)

    response = await post_job(browser, a_job(title="   "))

    assert response.status_code == 422, response.text


@pytest.mark.parametrize(
    "written",
    [
        {"employment_type": "Full time"},
        {"employment_type": "freelance"},
        {"work_mode": "Remote"},
        {"work_mode": "field"},
    ],
)
async def test_employment_type_and_work_mode_are_chosen_and_never_written(
    browser: AsyncClient, mailbox: Mailbox, written: dict[str, str]
) -> None:
    """Both are fixed sets, so the spelling a recruiter would have typed is not a value —
    which is what stops "Full time" and "Full-time" being two kinds of job."""
    await an_admin(browser, mailbox)

    response = await post_job(browser, a_job(**written))

    assert response.status_code == 422, response.text


async def test_a_remote_job_says_where_a_candidate_has_to_be_based(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Work mode is not a place. Remote used to be written into the Location, which made the two
    answers one; a remote Job's Location is where the Candidate lives, not where the team sits."""
    await an_admin(browser, mailbox)

    job = await a_created_job(browser, work_mode="remote", location_key="sy-aleppo")

    assert job["work_mode"] == "remote"
    assert job["location_key"] == "sy-aleppo"
    assert job["location_name"] == "Aleppo"


async def test_a_remote_job_that_names_no_place_is_open_to_anywhere(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Anywhere is the absence of a Location, which is what keeps "Remote" out of the place
    taxonomy."""
    await an_admin(browser, mailbox)

    job = await a_created_job(browser, work_mode="remote", location_key=None)

    assert (job["location_key"], job["location_name"]) == (None, None)
    assert (await change_job(browser, job["id"], status="published")).status_code == 200


@pytest.mark.parametrize("travelled_to", ["onsite", "hybrid"])
async def test_work_somebody_travels_to_names_the_place_they_travel_to(
    browser: AsyncClient, mailbox: Mailbox, travelled_to: str
) -> None:
    await an_admin(browser, mailbox)

    refused = await post_job(browser, a_job(work_mode=travelled_to, location_key=None))

    assert refused.status_code == 422, refused.text
    assert [error["location"] for error in refused.json()["errors"]] == ["body.location_key"]


async def test_a_job_cannot_be_edited_into_travelling_nowhere(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """The rule holds over the Job the edit leaves behind, not over the fields the edit names."""
    await an_admin(browser, mailbox)
    job = await a_created_job(browser, work_mode="remote", location_key=None)

    refused = await change_job(browser, job["id"], work_mode="onsite")

    assert refused.status_code == 422, refused.text
    assert [error["location"] for error in refused.json()["errors"]] == ["body.location_key"]


async def test_a_job_that_will_not_say_how_it_is_worked_is_not_published(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """A listing that will not say is one nobody can judge, so the answer is owed at publication
    rather than at the first keystroke of a draft."""
    await an_admin(browser, mailbox)
    job = await a_created_job(browser, work_mode=None)

    refused = await change_job(browser, job["id"], status="published")

    assert refused.status_code == 409, refused.text
    assert (await read_job(browser, job["id"]))["status"] == "draft"


async def test_a_published_job_cannot_have_its_work_mode_taken_away(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    assert (await change_job(browser, job["id"], status="published")).status_code == 200

    refused = await change_job(browser, job["id"], work_mode=None)

    assert refused.status_code == 409, refused.text
    assert (await read_job(browser, job["id"]))["work_mode"] == "onsite"


async def test_both_sets_can_be_changed_after_the_job_is_written(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    edited = await change_job(browser, job["id"], employment_type="volunteer", work_mode="hybrid")

    assert edited.status_code == 200, edited.text
    assert edited.json()["employment_type"] == "volunteer"
    assert edited.json()["work_mode"] == "hybrid"


async def test_a_draft_has_never_gone_live(browser: AsyncClient, mailbox: Mailbox) -> None:
    await an_admin(browser, mailbox)

    job = await a_created_job(browser)

    assert job["published_at"] is None


async def test_publishing_records_when_the_job_went_live(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    published = await change_job(browser, job["id"], status="published")

    assert published.status_code == 200, published.text
    assert published.json()["published_at"] is not None


async def test_republishing_keeps_the_first_publication_date(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """A Job closed and reopened went live when it first went live. Rewriting the date would
    make a Job that has been around for months look like this week's news."""
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    first = (await change_job(browser, job["id"], status="published")).json()["published_at"]
    await change_job(browser, job["id"], status="closed")

    republished = await change_job(browser, job["id"], status="published")

    assert republished.status_code == 200, republished.text
    assert republished.json()["published_at"] == first


async def test_a_job_carries_how_many_applications_it_has(
    browser: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await a_signed_in_candidate(other_browser, mailbox)
    await an_application(db_session, job["id"], await my_id(other_browser))

    listed = await browser.get(TENANT_JOBS)

    assert listed.status_code == 200, listed.text
    assert [item["application_count"] for item in listed.json()["items"]] == [1]
    assert (await read_job(browser, job["id"]))["application_count"] == 1


async def test_a_job_nobody_has_applied_to_counts_none(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)

    assert job["application_count"] == 0
    assert (await browser.get(TENANT_JOBS)).json()["items"][0]["application_count"] == 0


async def test_a_job_carries_how_many_times_it_has_been_read(
    browser: AsyncClient, visitor: AsyncClient, mailbox: Mailbox
) -> None:
    await an_admin(browser, mailbox)
    job = await a_published_job(browser)
    assert job["view_count"] == 0

    await read_public_job(visitor, job["id"])

    listed = await browser.get(TENANT_JOBS)
    assert [item["view_count"] for item in listed.json()["items"]] == [1]
    assert (await read_job(browser, job["id"]))["view_count"] == 1


async def test_editing_a_published_job_does_not_pretend_it_just_went_live(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Every Job published before the column existed carries a null. Stamping one on an
    unrelated edit would report a Job open since March among this week's."""
    await an_admin(browser, mailbox)
    job = await a_created_job(browser)
    await change_job(browser, job["id"], status="published")
    await forget_when_it_went_live(db_session, job["id"])

    edited = await change_job(browser, job["id"], title="Staff Backend Engineer")

    assert edited.status_code == 200, edited.text
    assert edited.json()["published_at"] is None
