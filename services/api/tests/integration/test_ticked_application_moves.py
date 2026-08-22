from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import (
    ApplicationStatus,
    Communication,
    CommunicationStatus,
    CommunicationType,
    StatusChangeSource,
)
from sync_core.telling import TELLING_DELAY
from tests.support.applications import (
    a_candidate_who_can_apply,
    a_moved_application,
    an_accepted_application,
    communications_of,
    move_the_ticked,
    notifications_of,
    status_history_of,
    stored_application,
    the_telling_comes,
    the_ticked_moved,
)
from tests.support.jobs import a_published_job
from tests.support.mailbox import Mailbox
from tests.support.notifications import my_notifications, my_unread_count
from tests.support.tenants import an_admin


async def rejections_of(session: AsyncSession, application_id: str) -> list[Communication]:
    """Only the rejection emails. Applying queues a confirmation of its own."""
    return [
        one
        for one in await communications_of(session, application_id)
        if one.communication_type is CommunicationType.APPLICATION_REJECTION
    ]


async def a_job_two_people_applied_to(
    recruiter: AsyncClient,
    one: AsyncClient,
    other: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(one, mailbox, session, "first")
    first = await an_accepted_application(one, job["id"])
    await a_candidate_who_can_apply(other, mailbox, session, "second")
    second = await an_accepted_application(other, job["id"])
    return job, first, second


async def test_the_ticked_move_reaches_the_ids_it_names_and_nothing_else(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, ticked, untouched = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    moved = await the_ticked_moved(recruiter, [ticked["id"]])

    assert moved["moved"] == 1
    assert (await stored_application(db_session, ticked["id"])).status is ApplicationStatus.REJECTED
    assert (await stored_application(db_session, untouched["id"])).status is ApplicationStatus.NEW


async def test_the_ticked_move_spans_the_statuses_the_ticks_turned_out_to_hold(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """One request, whatever the ticked rows were standing in when they were ticked."""
    _, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, second["id"], ApplicationStatus.INTERVIEW)

    moved = await the_ticked_moved(recruiter, [first["id"], second["id"]])

    assert moved["moved"] == 2
    for each in (first, second):
        assert (await stored_application(db_session, each["id"])).status is (
            ApplicationStatus.REJECTED
        )


async def test_every_ending_a_set_of_ticks_makes_shares_one_telling(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The one thing moving them one at a time could not do: a single moment for the whole set."""
    _, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    moved = await the_ticked_moved(recruiter, [first["id"], second["id"]])

    told_at = datetime.fromisoformat(moved["told_at"])
    assert abs(told_at - (datetime.now(UTC) + TELLING_DELAY)) < timedelta(minutes=1)
    for each in (first, second):
        assert (await stored_application(db_session, each["id"])).told_at == told_at
        [queued] = await rejections_of(db_session, each["id"])
        assert queued.available_at == told_at
        assert queued.status is CommunicationStatus.QUEUED
    assert await my_notifications(other_browser) == []
    assert await my_unread_count(other_browser) == 0


async def test_a_ticked_ending_records_the_recruiter_who_took_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, first, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    await the_ticked_moved(recruiter, [first["id"]])

    *_, ending = await status_history_of(db_session, first["id"])
    assert ending.change_source is StatusChangeSource.RECRUITER
    assert ending.previous_status is ApplicationStatus.NEW
    assert ending.new_status is ApplicationStatus.REJECTED
    assert ending.changed_by_profile_id is not None


async def test_a_tick_on_something_that_already_moved_on_takes_no_part(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """What the portal reads as "1 of 2 ended": no refusal, a lower count."""
    _, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, second["id"], ApplicationStatus.HIRED)

    moved = await the_ticked_moved(recruiter, [first["id"], second["id"]])

    assert moved["moved"] == 1
    assert (await stored_application(db_session, second["id"])).status is ApplicationStatus.HIRED


async def test_a_tick_on_an_id_that_is_nobodys_takes_no_part(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, first, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    moved = await the_ticked_moved(recruiter, [first["id"], str(uuid4())])

    assert moved["moved"] == 1


async def test_a_ticked_move_leaves_another_tenants_applications_alone(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """An id belonging to somebody else reaches nothing, even named outright."""
    mine = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session, "first")
    untouched = await an_accepted_application(other_browser, mine["id"])

    await an_admin(recruiter, mailbox, "rival")
    theirs = await a_published_job(recruiter)
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "second")
    ours = await an_accepted_application(third_browser, theirs["id"])

    moved = await the_ticked_moved(recruiter, [ours["id"], untouched["id"]])

    assert moved["moved"] == 1
    assert (await stored_application(db_session, ours["id"])).status is ApplicationStatus.REJECTED
    assert (await stored_application(db_session, untouched["id"])).status is ApplicationStatus.NEW


async def test_ticking_the_rejections_back_to_reviewing_takes_the_rejection_back(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The reopen a set may take: silent, and it cancels what the ending had queued."""
    _, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await the_ticked_moved(recruiter, [first["id"], second["id"]])

    reopened = await the_ticked_moved(
        recruiter, [first["id"], second["id"]], to=ApplicationStatus.REVIEWING
    )

    assert reopened == {"moved": 2, "told_at": None}
    for each in (first, second):
        stored = await stored_application(db_session, each["id"])
        assert stored.status is ApplicationStatus.REVIEWING
        assert stored.told_at is None
        assert await notifications_of(db_session, each["id"]) == []
        [queued] = await rejections_of(db_session, each["id"])
        assert queued.status is CommunicationStatus.CANCELLED
        assert queued.completed_at is not None
    assert await my_notifications(other_browser) == []
    assert await my_unread_count(other_browser) == 0


async def test_reopening_a_rejection_the_candidate_already_read_keeps_what_they_read(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Past the Telling there is nothing to take back: a Notification they have read is not the
    platform's to drop, and the Telling stands as the record of what they were told."""
    _, first, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await the_ticked_moved(recruiter, [first["id"]])
    await the_telling_comes(db_session, first["id"])

    reopened = await the_ticked_moved(recruiter, [first["id"]], to=ApplicationStatus.REVIEWING)

    assert reopened == {"moved": 1, "told_at": None}
    stored = await stored_application(db_session, first["id"])
    assert stored.status is ApplicationStatus.REVIEWING
    assert stored.told_at is not None
    assert len(await notifications_of(db_session, first["id"])) == 1


async def test_a_ticked_move_along_the_ladder_tells_nobody(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, first["id"], ApplicationStatus.REVIEWING)
    await a_moved_application(recruiter, second["id"], ApplicationStatus.REVIEWING)

    moved = await the_ticked_moved(recruiter, [first["id"], second["id"]], to="shortlisted")

    assert moved == {"moved": 2, "told_at": None}
    for each in (first, second):
        assert (await stored_application(db_session, each["id"])).status is (
            ApplicationStatus.SHORTLISTED
        )
        assert await rejections_of(db_session, each["id"]) == []
    assert await my_notifications(other_browser) == []


async def test_a_ticked_move_off_new_tells_them_their_application_is_in_review(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, first, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    moved = await the_ticked_moved(recruiter, [first["id"]], to="reviewing")

    assert moved == {"moved": 1, "told_at": None}
    [told] = await my_notifications(other_browser)
    assert told["payload"]["stage"] == "in_review"
    assert told["payload"]["previous_stage"] == "received"
    assert told["payload"]["application_id"] == first["id"]


async def test_a_ticked_move_never_touches_the_screening_verdict(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, first, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    verdict = (await stored_application(db_session, first["id"])).qualification_status

    await the_ticked_moved(recruiter, [first["id"]])

    assert (await stored_application(db_session, first["id"])).qualification_status is verdict


async def test_a_ticked_move_will_not_send_a_set_where_a_set_cannot_go(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, first, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    for nowhere in (ApplicationStatus.HIRED, ApplicationStatus.NEW, ApplicationStatus.WITHDRAWN):
        refused = await move_the_ticked(recruiter, [first["id"]], to=nowhere)
        assert refused.status_code == 422, refused.text


async def test_a_ticked_move_refuses_to_name_nothing_at_all(recruiter: AsyncClient) -> None:
    refused = await move_the_ticked(recruiter, [])

    assert refused.status_code == 422, refused.text


async def test_a_ticked_move_refuses_the_same_application_twice(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Counted twice, the answer could not be read against the ticks that were sent."""
    _, first, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    refused = await move_the_ticked(recruiter, [first["id"], first["id"]])

    assert refused.status_code == 422, refused.text


async def test_moving_the_ticked_is_only_for_recruiters(
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session, "first")

    refused = await move_the_ticked(other_browser, [str(uuid4())])

    assert refused.status_code == 403, refused.text
