from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID, uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import ApplicationStatus
from tests.support.applications import (
    A_START_DATE,
    a_candidate_who_can_apply,
    a_moved_application,
    an_accepted_application,
    an_answered_hire,
)
from tests.support.crm import (
    CANDIDATE_NOT_FOUND,
    a_candidate_nobody_has_met,
    list_candidate_placements,
    placements_of_candidate,
)
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id


async def a_hire_of(
    recruiter: AsyncClient,
    browser: AsyncClient,
    *,
    title: str,
    start_date: date = A_START_DATE,
    answer: bool | None = None,
) -> dict[str, Any]:
    """One Job of this Tenant, this Candidate hired for it, and their answer if they gave one."""
    job = await a_published_job(recruiter, title=title)
    application = await an_accepted_application(browser, job["id"])
    await a_moved_application(
        recruiter, application["id"], ApplicationStatus.HIRED, start_date=start_date
    )
    if answer is not None:
        await an_answered_hire(browser, application["id"], confirmed=answer)
    return {"job": job, "application": application}


async def test_the_card_names_the_job_and_the_day_the_work_started(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    hired = await a_hire_of(
        recruiter, other_browser, title="MEAL Officer", start_date=date(2026, 9, 1), answer=True
    )

    [placement] = await placements_of_candidate(recruiter, candidate_id)

    assert placement["job"]["id"] == hired["job"]["id"]
    assert placement["job"]["title"] == "MEAL Officer"
    assert placement["start_date"] == "2026-09-01"
    assert placement["application_id"] == hired["application"]["id"]


async def test_a_person_placed_twice_reads_as_a_list_newest_start_first(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    first = await a_hire_of(
        recruiter, other_browser, title="Field Officer", start_date=date(2026, 3, 1), answer=True
    )
    second = await a_hire_of(
        recruiter, other_browser, title="MEAL Officer", start_date=date(2026, 9, 1), answer=True
    )

    placed = await placements_of_candidate(recruiter, candidate_id)

    assert [one["application_id"] for one in placed] == [
        second["application"]["id"],
        first["application"]["id"],
    ]


async def test_two_placements_that_start_on_one_day_read_newest_claim_first(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    claimed_first = await a_hire_of(
        recruiter, other_browser, title="Field Officer", start_date=date(2026, 9, 1), answer=True
    )
    claimed_second = await a_hire_of(
        recruiter, other_browser, title="MEAL Officer", start_date=date(2026, 9, 1), answer=True
    )

    placed = await placements_of_candidate(recruiter, candidate_id)

    assert [one["application_id"] for one in placed] == [
        claimed_second["application"]["id"],
        claimed_first["application"]["id"],
    ]


async def test_a_claim_the_candidate_has_not_confirmed_is_no_placement(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    candidate_id = await my_id(other_browser)
    await a_hire_of(recruiter, other_browser, title="Field Officer")
    await a_hire_of(recruiter, other_browser, title="MEAL Officer", answer=False)

    assert await placements_of_candidate(recruiter, candidate_id) == []


async def test_a_rival_tenants_placement_of_the_same_person_is_not_here(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session, is_searchable=True)
    candidate_id = await my_id(other_browser)
    await a_hire_of(rival, other_browser, title="Logistics Lead", answer=True)

    assert await placements_of_candidate(recruiter, candidate_id) == []


async def test_a_candidate_this_tenant_cannot_reach_is_the_same_as_one_who_is_not_there(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    unmet = await a_candidate_nobody_has_met(other_browser, mailbox)

    for candidate_id in (unmet, uuid4()):
        refused = await list_candidate_placements(recruiter, candidate_id)
        assert refused.status_code == 404, refused.text
        assert refused.json()["type"] == CANDIDATE_NOT_FOUND


async def test_a_candidate_this_tenant_has_placed_nobody_of_reads_as_an_empty_list(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    candidate_id: UUID = await my_id(other_browser)
    job = await a_published_job(recruiter)
    await an_accepted_application(other_browser, job["id"])

    assert await placements_of_candidate(recruiter, candidate_id) == []
