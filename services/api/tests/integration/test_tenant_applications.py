from __future__ import annotations

from typing import Any
from uuid import UUID

from httpx import AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import ApplicationStatus, QualificationStatus
from tests.support.applications import (
    TENANT_APPLICATIONS,
    a_candidate_who_can_apply,
    an_accepted_application,
    move_to,
)
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.stats import decide, received_days_ago


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


def counts_of(listed: Response) -> dict[str, int]:
    return {one["status"]: one["count"] for one in listed.json()["status_counts"]}


def verdicts_of(listed: Response) -> dict[str, int]:
    return {one["verdict"]: one["count"] for one in listed.json()["verdict_counts"]}


async def a_qualified_and_a_disqualified_one(
    recruiter: AsyncClient, applicant: AsyncClient, mailbox: Mailbox, session: AsyncSession
) -> tuple[dict[str, str], dict[str, str]]:
    """The pair, with the verdicts written directly: how Screening reaches one is its own
    business, and this list only ever narrows by what it reached."""
    older, newer = await a_pair_of_applications(recruiter, applicant, mailbox, session)
    await decide(
        session, UUID(older["application"]), qualification_status=QualificationStatus.QUALIFIED
    )
    await decide(
        session, UUID(newer["application"]), qualification_status=QualificationStatus.DISQUALIFIED
    )
    return older, newer


def ids_in(listed: Response) -> list[str]:
    items: list[dict[str, Any]] = listed.json()["items"]
    return [item["id"] for item in items]


async def test_a_tenant_with_no_applications_lists_none(recruiter: AsyncClient) -> None:
    listed = await recruiter.get(TENANT_APPLICATIONS)

    assert listed.status_code == 200, listed.text
    assert listed.json()["items"] == []
    assert listed.json()["next_cursor"] is None
    assert counts_of(listed) == {status.value: 0 for status in ApplicationStatus}
    assert verdicts_of(listed) == {verdict.value: 0 for verdict in QualificationStatus}


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
        "work_mode": "onsite",
    }


async def test_a_row_says_how_its_job_is_worked_so_a_placeless_one_reads_as_anywhere(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Without the Work mode, a Job open to Anywhere is a row with no place on it at all, which
    reads as a Job nobody said anything about."""
    job = await a_published_job(recruiter, work_mode="remote", location_key=None)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    await an_accepted_application(other_browser, job["id"])

    [item] = (await recruiter.get(TENANT_APPLICATIONS)).json()["items"]

    assert (item["job"]["location_name"], item["job"]["work_mode"]) == (None, "remote")


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


async def test_the_list_takes_several_stages_at_once(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    moved = await move_to(recruiter, newer["application"], "reviewing")
    assert moved.status_code == 200, moved.text

    both = await recruiter.get(TENANT_APPLICATIONS, params={"status": ["new", "reviewing"]})
    neither = await recruiter.get(TENANT_APPLICATIONS, params={"status": ["hired", "withdrawn"]})

    assert set(ids_in(both)) == {older["application"], newer["application"]}
    assert ids_in(neither) == []


async def test_the_list_counts_every_stage_whatever_it_is_narrowed_to(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The count beside a stage says what the filter is hiding, so it is taken before it hides."""
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    moved = await move_to(recruiter, newer["application"], "reviewing")
    assert moved.status_code == 200, moved.text

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"status": "new"})

    assert ids_in(listed) == [older["application"]]
    assert counts_of(listed)["new"] == 1
    assert counts_of(listed)["reviewing"] == 1
    assert counts_of(listed)["hired"] == 0


async def test_the_job_filter_narrows_the_counts_as_well_as_the_list(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Unlike the stage filter: the counts describe the list the reader is looking at."""
    field, meal = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    moved = await move_to(recruiter, meal["application"], "reviewing")
    assert moved.status_code == 200, moved.text

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"job_id": field["job"]})

    assert ids_in(listed) == [field["application"]]
    assert counts_of(listed)["new"] == 1
    assert counts_of(listed)["reviewing"] == 0


async def test_the_list_can_be_narrowed_to_what_arrived_recently(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The windows are rolling, the way the Dashboard's own numbers are: `7d` is the last 168
    hours rather than this week so far."""
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    await received_days_ago(db_session, UUID(older["application"]), 10)

    week = await recruiter.get(TENANT_APPLICATIONS, params={"received_within": "7d"})
    month = await recruiter.get(TENANT_APPLICATIONS, params={"received_within": "30d"})
    ever = await recruiter.get(TENANT_APPLICATIONS)

    assert ids_in(week) == [newer["application"]]
    assert set(ids_in(month)) == {older["application"], newer["application"]}
    assert set(ids_in(ever)) == {older["application"], newer["application"]}


async def test_the_window_narrows_the_counts_as_well_as_the_list(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    moved = await move_to(recruiter, newer["application"], "reviewing")
    assert moved.status_code == 200, moved.text
    await received_days_ago(db_session, UUID(older["application"]), 10)

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"received_within": "7d"})

    assert ids_in(listed) == [newer["application"]]
    assert counts_of(listed)["reviewing"] == 1
    assert counts_of(listed)["new"] == 0


async def test_the_list_can_be_narrowed_to_one_verdict(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_qualified_and_a_disqualified_one(
        recruiter, other_browser, mailbox, db_session
    )

    qualified = await recruiter.get(
        TENANT_APPLICATIONS, params={"qualification_status": "qualified"}
    )
    both = await recruiter.get(
        TENANT_APPLICATIONS, params={"qualification_status": ["qualified", "disqualified"]}
    )
    neither = await recruiter.get(
        TENANT_APPLICATIONS, params={"qualification_status": ["pending", "review_required"]}
    )

    assert ids_in(qualified) == [older["application"]]
    assert set(ids_in(both)) == {older["application"], newer["application"]}
    assert ids_in(neither) == []


async def test_the_list_counts_every_verdict_whatever_it_is_narrowed_to(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The count beside a verdict says what the filter is hiding, so it is taken before it hides."""
    older, _newer = await a_qualified_and_a_disqualified_one(
        recruiter, other_browser, mailbox, db_session
    )

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"qualification_status": "qualified"})

    assert ids_in(listed) == [older["application"]]
    assert verdicts_of(listed)["qualified"] == 1
    assert verdicts_of(listed)["disqualified"] == 1
    assert verdicts_of(listed)["review_required"] == 0


async def test_the_verdict_filter_narrows_the_stage_counts(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Each filter's counts are narrowed by the other, so each describes the list on screen."""
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    moved = await move_to(recruiter, newer["application"], "reviewing")
    assert moved.status_code == 200, moved.text
    await decide(
        db_session, UUID(older["application"]), qualification_status=QualificationStatus.QUALIFIED
    )
    await decide(
        db_session,
        UUID(newer["application"]),
        qualification_status=QualificationStatus.DISQUALIFIED,
    )

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"qualification_status": "qualified"})

    assert ids_in(listed) == [older["application"]]
    assert counts_of(listed)["new"] == 1
    assert counts_of(listed)["reviewing"] == 0


async def test_the_stage_filter_narrows_the_verdict_counts(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)
    moved = await move_to(recruiter, newer["application"], "reviewing")
    assert moved.status_code == 200, moved.text
    await decide(
        db_session, UUID(older["application"]), qualification_status=QualificationStatus.QUALIFIED
    )
    await decide(
        db_session,
        UUID(newer["application"]),
        qualification_status=QualificationStatus.DISQUALIFIED,
    )

    listed = await recruiter.get(TENANT_APPLICATIONS, params={"status": "new"})

    assert ids_in(listed) == [older["application"]]
    assert verdicts_of(listed)["qualified"] == 1
    assert verdicts_of(listed)["disqualified"] == 0


async def test_a_verdict_the_platform_does_not_offer_is_refused(recruiter: AsyncClient) -> None:
    assert (
        await recruiter.get(TENANT_APPLICATIONS, params={"qualification_status": "promising"})
    ).status_code == 422


async def test_the_list_can_be_read_from_the_oldest_end(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)

    oldest = await recruiter.get(TENANT_APPLICATIONS, params={"sort": "oldest"})

    assert oldest.status_code == 200, oldest.text
    assert ids_in(oldest) == [older["application"], newer["application"]]


async def test_the_oldest_end_pages_from_its_own_cursor(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    older, newer = await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)

    first = await recruiter.get(TENANT_APPLICATIONS, params={"limit": 1, "sort": "oldest"})
    cursor = first.json()["next_cursor"]
    assert ids_in(first) == [older["application"]]
    assert cursor is not None

    rest = await recruiter.get(
        TENANT_APPLICATIONS, params={"limit": 1, "sort": "oldest", "cursor": cursor}
    )
    assert ids_in(rest) == [newer["application"]]
    assert rest.json()["next_cursor"] is None


async def test_a_cursor_from_one_order_does_not_resume_the_other(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Following it would serve the first page again from the far end rather than the second."""
    await a_pair_of_applications(recruiter, other_browser, mailbox, db_session)

    first = await recruiter.get(TENANT_APPLICATIONS, params={"limit": 1, "sort": "oldest"})
    cursor = first.json()["next_cursor"]

    wrong = await recruiter.get(
        TENANT_APPLICATIONS, params={"limit": 1, "sort": "newest", "cursor": cursor}
    )

    assert wrong.status_code == 422


async def test_an_order_the_platform_does_not_offer_is_refused(recruiter: AsyncClient) -> None:
    assert (
        await recruiter.get(TENANT_APPLICATIONS, params={"sort": "alphabetically"})
    ).status_code == 422


async def test_a_window_the_platform_does_not_offer_is_refused(recruiter: AsyncClient) -> None:
    assert (
        await recruiter.get(TENANT_APPLICATIONS, params={"received_within": "since-tuesday"})
    ).status_code == 422


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
