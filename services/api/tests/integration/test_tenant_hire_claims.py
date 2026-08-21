from __future__ import annotations

from datetime import date
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import ApplicationStatus
from tests.support.applications import (
    A_START_DATE,
    a_candidate_who_can_apply,
    a_moved_application,
    an_accepted_application,
    an_answered_hire,
    communications_of,
    list_hire_claims,
    tenant_hire_claims,
)
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.notifications import my_notifications


async def a_hire_claim(
    recruiter: AsyncClient,
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    *,
    job: dict[str, Any],
    label: str = "applicant",
    start_date: date = A_START_DATE,
    answer: bool | None = None,
    **profile: Any,
) -> str:
    """One Application this Tenant says it hired, answered or not.

    The answer is given straight away, because a Candidate answers from their own session and
    the next one signs in over it.
    """
    await a_candidate_who_can_apply(browser, mailbox, session, label, **profile)
    application = await an_accepted_application(browser, job["id"])
    await a_moved_application(
        recruiter, application["id"], ApplicationStatus.HIRED, start_date=start_date
    )
    if answer is not None:
        await an_answered_hire(browser, application["id"], confirmed=answer)
    identifier: str = application["id"]
    return identifier


def counts_of(page: dict[str, Any]) -> dict[str, int]:
    return {count["confirmation"]: count["count"] for count in page["counts"]}


def ids_in(page: dict[str, Any]) -> list[str]:
    return [claim["application_id"] for claim in page["items"]]


async def one_of_each(
    recruiter: AsyncClient,
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
) -> dict[str, str]:
    """Three claims on one Job: one confirmed, one nobody answered, one denied."""
    job = await a_published_job(recruiter)
    return {
        "confirmed": await a_hire_claim(
            recruiter, browser, mailbox, session, job=job, label="confirmer", answer=True
        ),
        "unanswered": await a_hire_claim(
            recruiter, browser, mailbox, session, job=job, label="waiter"
        ),
        "denied": await a_hire_claim(
            recruiter, browser, mailbox, session, job=job, label="denier", answer=False
        ),
    }


async def test_the_list_opens_on_the_hires_the_candidate_confirmed(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    claims = await one_of_each(recruiter, other_browser, mailbox, db_session)

    page = await tenant_hire_claims(recruiter)

    assert ids_in(page) == [claims["confirmed"]]
    assert page["items"][0]["confirmation"] == "confirmed"


async def test_the_waiting_tab_holds_what_nobody_has_answered(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    claims = await one_of_each(recruiter, other_browser, mailbox, db_session)

    page = await tenant_hire_claims(recruiter, confirmation="unanswered")

    assert ids_in(page) == [claims["unanswered"]]
    [waiting] = page["items"]
    assert waiting["answered_at"] is None, "nothing has been answered, so nothing has a moment"
    assert waiting["claimed_at"] is not None, "the claim's age is what the row reads"


async def test_the_denied_tab_holds_what_the_candidate_denied(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    claims = await one_of_each(recruiter, other_browser, mailbox, db_session)

    page = await tenant_hire_claims(recruiter, confirmation="denied")

    assert ids_in(page) == [claims["denied"]]
    assert page["items"][0]["answered_at"] is not None


async def test_every_tab_carries_its_own_count_whichever_tab_is_read(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await one_of_each(recruiter, other_browser, mailbox, db_session)

    opened = await tenant_hire_claims(recruiter)
    denied = await tenant_hire_claims(recruiter, confirmation="denied")

    assert counts_of(opened) == {"confirmed": 1, "unanswered": 1, "denied": 1}
    assert counts_of(denied) == counts_of(opened), "a tab narrows the list, never the counts"


async def test_a_row_names_the_person_the_job_and_the_day_the_work_started(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    application_id = await a_hire_claim(
        recruiter,
        other_browser,
        mailbox,
        db_session,
        job=job,
        start_date=date(2026, 9, 1),
        answer=True,
        full_name="Rima Sabbagh",
    )

    [placement] = (await tenant_hire_claims(recruiter))["items"]

    assert placement["application_id"] == application_id
    assert placement["candidate_name"] == "Rima Sabbagh"
    assert placement["job"]["id"] == job["id"]
    assert placement["job"]["title"] == job["title"]
    assert placement["job"]["location_name"] == "Damascus"
    assert placement["start_date"] == "2026-09-01"


async def test_the_newest_claim_is_read_first(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    first = await a_hire_claim(
        recruiter, other_browser, mailbox, db_session, job=job, label="first"
    )
    second = await a_hire_claim(
        recruiter, other_browser, mailbox, db_session, job=job, label="second"
    )

    page = await tenant_hire_claims(recruiter, confirmation="unanswered")

    assert ids_in(page) == [second, first]


async def test_the_list_pages_through_the_claims_it_has(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    first = await a_hire_claim(
        recruiter, other_browser, mailbox, db_session, job=job, label="first"
    )
    second = await a_hire_claim(
        recruiter, other_browser, mailbox, db_session, job=job, label="second"
    )

    opening = await tenant_hire_claims(recruiter, confirmation="unanswered", limit=1)
    following = await tenant_hire_claims(
        recruiter, confirmation="unanswered", limit=1, cursor=opening["next_cursor"]
    )

    assert ids_in(opening) == [second]
    assert ids_in(following) == [first]
    assert following["next_cursor"] is None


async def test_a_cursor_only_resumes_the_tab_it_was_issued_for(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await a_hire_claim(recruiter, other_browser, mailbox, db_session, job=job, label="first")
    await a_hire_claim(recruiter, other_browser, mailbox, db_session, job=job, label="second")
    waiting = await tenant_hire_claims(recruiter, confirmation="unanswered", limit=1)

    refused = await list_hire_claims(
        recruiter, confirmation="denied", cursor=waiting["next_cursor"]
    )

    assert refused.status_code == 422, refused.text


async def test_another_tenants_claims_are_not_here(
    recruiter: AsyncClient,
    rival: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    await a_hire_claim(recruiter, other_browser, mailbox, db_session, job=job, answer=True)

    page = await tenant_hire_claims(rival)

    assert page["items"] == []
    assert counts_of(page) == {"confirmed": 0, "unanswered": 0, "denied": 0}


async def test_a_denial_tells_nobody(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """The Tenant learns by the gap between its claims and its Placements, and by nothing else."""
    job = await a_published_job(recruiter)
    application_id = await a_hire_claim(recruiter, other_browser, mailbox, db_session, job=job)
    before = await my_notifications(other_browser)
    queued = [message.id for message in await communications_of(db_session, application_id)]

    await an_answered_hire(other_browser, application_id, confirmed=False)

    assert await my_notifications(other_browser) == before
    assert [message.id for message in await communications_of(db_session, application_id)] == queued
