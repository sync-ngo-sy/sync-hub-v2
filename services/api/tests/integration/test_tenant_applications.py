from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.applications import (
    TENANT_APPLICATIONS,
    a_candidate_who_can_apply,
    an_accepted_application,
    move_to,
)
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox


async def a_pair_of_applications(
    recruiter: AsyncClient, applicant: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> tuple[dict[str, str], dict[str, str]]:
    """One Candidate applying to two of the tenant's Jobs — which is the point of the list: it
    spans Jobs, where a Job's own triage list cannot."""
    field = await a_published_job(recruiter, title="Field Coordinator", location_key="sy-aleppo")
    meal = await a_published_job(recruiter, title="MEAL Officer")
    await a_candidate_who_can_apply(applicant, mailbox, session)
    first = await an_accepted_application(applicant, field["id"])
    second = await an_accepted_application(applicant, meal["id"])
    return {"job": field["id"], "application": first["id"]}, {
        "job": meal["id"],
        "application": second["id"],
    }


async def test_a_tenant_with_no_applications_lists_none(recruiter: AsyncClient) -> None:
    listed = await recruiter.get(TENANT_APPLICATIONS)

    assert listed.status_code == 200, listed.text
    assert listed.json() == {"items": [], "next_cursor": None}


async def test_the_list_is_refused_without_a_session(browser: AsyncClient) -> None:
    assert (await browser.get(TENANT_APPLICATIONS)).status_code == 401


async def test_applications_from_every_job_arrive_newest_first(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)

    listed = await recruiter.get(TENANT_APPLICATIONS)

    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()["items"]] == [
        newer["application"],
        older["application"],
    ]


async def test_every_row_names_the_job_it_came_in_for(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """A Job's own list can leave the Job implied. This one cannot: it spans all of them."""
    field, _meal = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)

    listed = await recruiter.get(TENANT_APPLICATIONS)

    jobs = {item["id"]: item["job"] for item in listed.json()["items"]}
    assert jobs[field["application"]] == {
        "id": field["job"],
        "title": "Field Coordinator",
        "location_name": "Aleppo",
    }


async def test_a_row_carries_who_applied_and_where_it_stands(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"])

    [item] = (await recruiter.get(TENANT_APPLICATIONS)).json()["items"]

    assert item["candidate_name"]
    assert item["status"] == "new"
    assert item["qualification_status"]
    assert item["applied_at"]


async def test_the_list_pages_by_cursor(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)

    first = await recruiter.get(TENANT_APPLICATIONS, params={"limit": 1})
    body = first.json()

    assert [item["id"] for item in body["items"]] == [newer["application"]]
    assert body["next_cursor"] is not None

    rest = await recruiter.get(
        TENANT_APPLICATIONS, params={"limit": 1, "cursor": body["next_cursor"]}
    )
    assert [item["id"] for item in rest.json()["items"]] == [older["application"]]
    assert rest.json()["next_cursor"] is None


async def test_the_list_can_be_narrowed_to_one_stage(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    _older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    moved = await move_to(recruiter, newer["application"], "reviewing")
    assert moved.status_code == 200, moved.text

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"status": "reviewing"})

    assert [item["id"] for item in listed.json()["items"]] == [newer["application"]]


async def test_the_list_can_be_narrowed_to_one_job(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    field, _meal = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"job_id": field["job"]})

    assert [item["id"] for item in listed.json()["items"]] == [field["application"]]


async def test_another_tenants_applications_are_not_in_this_list(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    theirs = await a_published_job(rival, title="Their role")
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, theirs["id"])

    listed = await recruiter.get(TENANT_APPLICATIONS)

    assert listed.json()["items"] == []
    assert (await rival.get(TENANT_APPLICATIONS)).json()["items"] != []


async def test_a_job_belonging_to_another_tenant_narrows_to_nothing(
    recruiter: AsyncClient, rival: AsyncClient, mailbox: Mailbox
) -> None:
    """Not a 404: the filter is a filter, and a tenant asking about a Job it cannot see is
    asking about no Applications of its own."""
    theirs = await a_published_job(rival, title="Their role")

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"job_id": theirs["id"]})

    assert listed.status_code == 200, listed.text
    assert listed.json()["items"] == []
