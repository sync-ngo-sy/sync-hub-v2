from __future__ import annotations

from datetime import date
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import ApplicationStatus, HireConfirmation
from tests.support.applications import (
    A_START_DATE,
    a_candidate_who_can_apply,
    a_moved_application,
    a_reviewed_application,
    an_accepted_application,
    an_answered_hire,
    answer_the_hire,
    hire_claim_of,
    move_to,
    my_applications,
    placements,
)
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox


async def a_claimed_hire(
    recruiter: AsyncClient,
    browser: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
    *,
    start_date: date = A_START_DATE,
) -> str:
    """An Application a Tenant says it hired, waiting on the Candidate's answer."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(browser, mailbox, session)
    application = await an_accepted_application(browser, job["id"])
    await a_moved_application(
        recruiter, application["id"], ApplicationStatus.HIRED, start_date=start_date
    )
    identifier: str = application["id"]
    return identifier


async def test_marking_somebody_hired_records_the_day_the_work_started(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application_id = await a_claimed_hire(
        recruiter, other_browser, mailbox, db_session, start_date=date(2026, 9, 1)
    )

    claim = await hire_claim_of(db_session, application_id)

    assert claim is not None
    assert claim.start_date == date(2026, 9, 1)
    assert claim.confirmation is HireConfirmation.UNANSWERED
    assert claim.answered_at is None


async def test_a_hire_with_no_day_at_all_is_refused(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    refused = await recruiter.patch(
        f"/v1/tenants/me/applications/{application['id']}", json={"status": "hired"}
    )

    assert refused.status_code == 422, refused.text
    assert await hire_claim_of(db_session, application["id"]) is None


async def test_a_move_that_is_not_a_hire_may_not_name_a_start_date(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    refused = await move_to(
        recruiter, application["id"], ApplicationStatus.SHORTLISTED, start_date=A_START_DATE
    )

    assert refused.status_code == 422, refused.text


async def test_the_candidate_reads_the_claim_and_what_it_says(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_claimed_hire(recruiter, other_browser, mailbox, db_session, start_date=date(2026, 9, 1))

    [mine] = await my_applications(other_browser)

    assert mine["stage"] == "hired"
    assert mine["can_withdraw"] is False
    assert mine["hire"] == {
        "start_date": "2026-09-01",
        "confirmation": "unanswered",
        "claimed_at": mine["hire"]["claimed_at"],
        "answered_at": None,
    }


async def test_only_a_confirmed_claim_is_a_placement(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)
    assert await placements(db_session) == [], "a claim nobody confirmed counts for nothing"

    answered = await an_answered_hire(other_browser, application_id, confirmed=True)

    assert answered["confirmation"] == "confirmed"
    assert answered["answered_at"] is not None
    assert await placements(db_session) == [UUID(application_id)]


async def test_a_denied_claim_is_stored_and_is_never_a_placement(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)

    answered = await an_answered_hire(other_browser, application_id, confirmed=False)

    assert answered["confirmation"] == "denied"
    claim = await hire_claim_of(db_session, application_id)
    assert claim is not None
    assert claim.confirmation is HireConfirmation.DENIED
    assert await placements(db_session) == []


async def test_a_denied_claim_leaves_the_application_where_the_tenant_put_it(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """What happened is the Recruiter's to record; whether it is true is the Candidate's to say."""
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)

    await an_answered_hire(other_browser, application_id, confirmed=False)

    [mine] = await my_applications(other_browser)
    assert mine["stage"] == "hired"


async def test_the_answer_is_given_once_and_stands(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)
    await an_answered_hire(other_browser, application_id, confirmed=True)

    again = await answer_the_hire(other_browser, application_id, confirmed=False)

    assert again.status_code == 409, again.text
    assert again.json()["type"] == "urn:sync:problem:hire-claim-already-answered"
    assert await placements(db_session) == [UUID(application_id)]


async def test_answering_a_hire_nobody_claimed_is_a_404(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    refused = await answer_the_hire(other_browser, application["id"], confirmed=True)

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:hire-claim-not-found"


async def test_a_stranger_cannot_answer_somebody_elses_claim(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)
    await a_candidate_who_can_apply(browser, mailbox, db_session, "stranger")

    refused = await answer_the_hire(browser, application_id, confirmed=True)

    assert refused.status_code == 404, refused.text
    assert await placements(db_session) == []


async def test_the_recruiter_sees_an_unconfirmed_claim_on_the_application(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application_id = await a_claimed_hire(
        recruiter, other_browser, mailbox, db_session, start_date=date(2026, 9, 1)
    )

    review = await a_reviewed_application(recruiter, application_id)

    assert review["hire"]["start_date"] == "2026-09-01"
    assert review["hire"]["confirmation"] == "unanswered"


async def test_the_recruiter_sees_the_answer_once_it_is_given(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)
    await an_answered_hire(other_browser, application_id, confirmed=True)

    review = await a_reviewed_application(recruiter, application_id)

    assert review["hire"]["confirmation"] == "confirmed"
    assert review["hire"]["answered_at"] is not None


async def test_an_application_nobody_claimed_carries_no_hire(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    application = await an_accepted_application(other_browser, job["id"])

    review = await a_reviewed_application(recruiter, application["id"])

    assert review["hire"] is None


async def test_the_database_refuses_a_second_answer_even_from_the_service_role(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """RLS does not apply to the backend's role, so a trigger is what holds the answer."""
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)
    await an_answered_hire(other_browser, application_id, confirmed=True)

    with pytest.raises(DBAPIError):
        await db_session.execute(
            text(
                "update hire_claims set confirmation = 'denied', answered_at = now() "
                "where application_id = :id"
            ),
            {"id": application_id},
        )
    await db_session.rollback()


async def test_an_answer_always_records_when_it_was_given(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    application_id = await a_claimed_hire(recruiter, other_browser, mailbox, db_session)

    with pytest.raises(DBAPIError):
        await db_session.execute(
            text("update hire_claims set confirmation = 'confirmed' where application_id = :id"),
            {"id": application_id},
        )
    await db_session.rollback()
