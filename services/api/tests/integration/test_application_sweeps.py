from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

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
from sync_core.telling import TELLING_DELAY
from tests.support.applications import (
    a_candidate_who_can_apply,
    a_moved_application,
    a_swept_job,
    an_accepted_application,
    an_application_through,
    communications_of,
    job_applications_of,
    move_to,
    my_applications,
    notifications_of,
    status_history_of,
    stored_application,
    sweep_the_job,
    the_telling_comes,
)
from tests.support.jobs import a_published_job, a_tracked_link, link_report, read_job
from tests.support.mailbox import Mailbox
from tests.support.notifications import my_notifications, my_unread_count
from tests.support.stats import decide, stats_of
from tests.support.tenants import an_admin

UNDECIDED = ["new", "reviewing", "shortlisted", "interview", "offer"]


async def a_job_two_people_applied_to(
    recruiter: AsyncClient,
    one: AsyncClient,
    other: AsyncClient,
    mailbox: Mailbox,
    session: AsyncSession,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """One Job with two Applications on it, both still `new` — the smallest sweepable Job."""
    job = await a_published_job(recruiter)
    await a_candidate_who_can_apply(one, mailbox, session, "first")
    first = await an_accepted_application(one, job["id"])
    await a_candidate_who_can_apply(other, mailbox, session, "second")
    second = await an_accepted_application(other, job["id"])
    return job, first, second


def statuses_of(items: list[dict[str, Any]]) -> dict[str, str]:
    return {item["id"]: item["status"] for item in items}


async def test_a_sweep_ends_every_application_in_the_ticked_statuses(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, ticked, untouched = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, untouched["id"], ApplicationStatus.SHORTLISTED)

    swept = await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    assert swept["ended"] == 1
    listed = statuses_of(await job_applications_of(recruiter, job["id"], status=UNDECIDED))
    assert listed == {untouched["id"]: "shortlisted"}
    assert (await stored_application(db_session, ticked["id"])).status is ApplicationStatus.REJECTED


async def test_a_sweep_ends_any_combination_of_the_ticks_in_one_request(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, second["id"], ApplicationStatus.OFFER)

    swept = await a_swept_job(
        recruiter, job["id"], [ApplicationStatus.NEW, ApplicationStatus.OFFER]
    )

    assert swept["ended"] == 2
    assert await job_applications_of(recruiter, job["id"], status=UNDECIDED) == []
    ended = await job_applications_of(recruiter, job["id"], status="rejected")
    assert sorted(statuses_of(ended)) == sorted([first["id"], second["id"]])


async def test_a_sweep_leaves_every_status_it_did_not_tick(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, new_one, interviewing = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, interviewing["id"], ApplicationStatus.INTERVIEW)

    swept = await a_swept_job(recruiter, job["id"], [ApplicationStatus.INTERVIEW])

    assert swept["ended"] == 1
    assert (await stored_application(db_session, new_one["id"])).status is ApplicationStatus.NEW
    assert (await stored_application(db_session, new_one["id"])).told_at is None


async def test_a_sweep_records_a_history_entry_naming_the_recruiter_who_swept(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, application, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, application["id"], ApplicationStatus.REVIEWING)

    await a_swept_job(recruiter, job["id"], [ApplicationStatus.REVIEWING])

    *_, ending = await status_history_of(db_session, application["id"])
    assert ending.previous_status is ApplicationStatus.REVIEWING
    assert ending.new_status is ApplicationStatus.REJECTED
    assert ending.change_source is StatusChangeSource.RECRUITER
    assert ending.changed_by_profile_id is not None


async def test_a_sweep_holds_every_ending_to_one_telling_three_days_out(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    swept = await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    told_at = datetime.fromisoformat(swept["told_at"])
    assert abs(told_at - (datetime.now(UTC) + TELLING_DELAY)) < timedelta(minutes=1)
    for application in (first, second):
        stored = await stored_application(db_session, application["id"])
        assert stored.told_at == told_at
    assert [mine["stage"] for mine in await my_applications(other_browser)] == ["in_review"]
    assert await my_notifications(other_browser) == []
    assert await my_unread_count(other_browser) == 0


async def test_a_sweep_reaches_everybody_it_ended_at_the_telling(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    await the_telling_comes(db_session, first["id"])
    await the_telling_comes(db_session, second["id"])

    assert [mine["stage"] for mine in await my_applications(other_browser)] == ["not_selected"]
    [told] = await my_notifications(other_browser)
    assert told["payload"]["stage"] == "not_selected"
    assert told["payload"]["previous_stage"] == "received"
    assert told["payload"]["application_id"] == first["id"]
    assert told["payload"]["job_title"] == job["title"]
    assert told["payload"]["tenant_name"]
    assert await my_unread_count(third_browser) == 1


async def test_a_sweep_names_the_stage_the_candidate_stood_in_before_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """`new` reads as Received and the other four as In review, exactly as one move does."""
    job, application, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, application["id"], ApplicationStatus.OFFER)
    await a_swept_job(recruiter, job["id"], [ApplicationStatus.OFFER])

    await the_telling_comes(db_session, application["id"])

    told = await my_notifications(other_browser)
    assert [one["payload"]["previous_stage"] for one in told] == ["received", "in_review"]
    assert [one["payload"]["stage"] for one in told] == ["in_review", "not_selected"]


async def test_a_sweep_queues_one_rejection_email_per_ending(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    swept = await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    for application in (first, second):
        _confirmation, rejection = await communications_of(db_session, application["id"])
        assert rejection.communication_type is CommunicationType.APPLICATION_REJECTION
        assert rejection.status is CommunicationStatus.QUEUED
        assert rejection.available_at == datetime.fromisoformat(swept["told_at"])
        assert rejection.recipient
        assert rejection.tenant_id is not None
        assert rejection.initiated_by_recruiter_id is not None
        assert rejection.template_key == ApplicationRejection.template_key
        payload = payload_of(rejection.payload)
        assert isinstance(payload, ApplicationRejection)
        assert payload.job_title == job["title"]
        assert payload.candidate_name == "Amina Haddad"
        assert payload.application_id == UUID(application["id"])


async def test_a_sweep_inherits_the_screening_filter_the_list_had(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, qualified, disqualified = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await decide(
        db_session, UUID(qualified["id"]), qualification_status=QualificationStatus.QUALIFIED
    )
    await decide(
        db_session, UUID(disqualified["id"]), qualification_status=QualificationStatus.DISQUALIFIED
    )

    swept = await a_swept_job(
        recruiter, job["id"], [ApplicationStatus.NEW], qualification_statuses=["qualified"]
    )

    assert swept["ended"] == 1
    assert (
        await stored_application(db_session, disqualified["id"])
    ).status is ApplicationStatus.NEW


async def test_a_sweep_only_touches_the_job_it_names(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    swept_job, swept_application, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    another = await a_published_job(recruiter, title="MEAL Officer")
    elsewhere = await an_accepted_application(other_browser, another["id"])

    ended = await a_swept_job(recruiter, swept_job["id"], [ApplicationStatus.NEW])

    assert ended["ended"] == 2
    assert (await stored_application(db_session, elsewhere["id"])).status is ApplicationStatus.NEW
    assert swept_application["id"] != elsewhere["id"]


async def test_a_sweep_that_matches_nothing_ends_nothing_and_is_no_error(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, _first, _second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    swept = await a_swept_job(recruiter, job["id"], [ApplicationStatus.OFFER])

    assert swept["ended"] == 0
    assert swept["told_at"] is None
    assert await my_notifications(other_browser) == []


async def test_a_sweep_refuses_a_status_that_has_already_ended(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, application, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    for ended in (ApplicationStatus.HIRED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN):
        refused = await sweep_the_job(recruiter, job["id"], [ApplicationStatus.NEW, ended])
        assert refused.status_code == 422, refused.text

    assert (await stored_application(db_session, application["id"])).status is ApplicationStatus.NEW


async def test_a_sweep_refuses_to_tick_nothing_at_all(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, _first, _second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    no_ticks = await sweep_the_job(recruiter, job["id"], [])
    no_verdicts = await sweep_the_job(
        recruiter, job["id"], [ApplicationStatus.NEW], qualification_statuses=[]
    )

    assert no_ticks.status_code == 422, no_ticks.text
    assert no_verdicts.status_code == 422, no_verdicts.text


async def test_a_sweep_never_touches_the_screening_verdict(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, application, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await decide(
        db_session, UUID(application["id"]), qualification_status=QualificationStatus.QUALIFIED
    )

    await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    stored = await stored_application(db_session, application["id"])
    assert stored.qualification_status is QualificationStatus.QUALIFIED


async def test_another_tenants_job_cannot_be_swept(
    recruiter: AsyncClient,
    browser: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, application, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await an_admin(browser, mailbox, "rival")

    somebody_elses = await sweep_the_job(browser, job["id"], [ApplicationStatus.NEW])
    unknown = await sweep_the_job(browser, uuid4(), [ApplicationStatus.NEW])

    assert somebody_elses.status_code == 404, somebody_elses.text
    assert somebody_elses.json()["type"] == unknown.json()["type"]
    assert (await stored_application(db_session, application["id"])).status is ApplicationStatus.NEW


async def test_sweeping_is_only_for_recruiters(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, _first, _second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    refused = await sweep_the_job(other_browser, job["id"], [ApplicationStatus.NEW])

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == "urn:sync:problem:recruiter-only"


async def test_a_sweep_is_undone_by_reading_back_what_it_rejected_and_moving_it(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """No batch id anywhere: `rejected` and not yet told is a Reading, and a move takes it back."""
    job, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    swept = await job_applications_of(recruiter, job["id"], status="rejected")
    for application in swept:
        taken_back = await move_to(recruiter, application["id"], ApplicationStatus.REVIEWING)
        assert taken_back.status_code == 200, taken_back.text

    assert sorted(statuses_of(swept)) == sorted([first["id"], second["id"]])
    assert await my_notifications(other_browser) == []
    _confirmation, rejection = await communications_of(db_session, first["id"])
    assert rejection.status is CommunicationStatus.CANCELLED
    assert [mine["stage"] for mine in await my_applications(other_browser)] == ["in_review"]


async def the_rejection_of(session: AsyncSession, application_id: str | UUID) -> dict[str, Any]:
    """Everything one rejection leaves behind, as a shape two paths can be compared through.

    The Application, the candidate and the moment are left out: those are what differ between two
    rejections of two people. Everything else is what a rejection *is*, and the set-based ending
    and the single move have to agree on all of it.
    """
    application = await stored_application(session, application_id)
    status, told_at = application.status, application.told_at

    *_, ending = await status_history_of(session, application_id)
    decided_by = ending.id
    history = (
        ending.change_source,
        ending.previous_status,
        ending.new_status,
        ending.changed_by_profile_id is not None,
        ending.reason,
    )

    [bell] = await notifications_of(session, application_id)
    rang = (bell.type, bell.visible_at == told_at, bell.read_at)
    bell_payload = {name: value for name, value in bell.payload.items() if name != "application_id"}

    _confirmation, email = await communications_of(session, application_id)
    return {
        "status": status,
        "told_at_is_set": told_at is not None,
        "history": history,
        "bell": rang,
        "bell_payload": bell_payload,
        "email": (
            email.channel,
            email.communication_type,
            email.status,
            email.template_key,
            email.available_at == told_at,
            email.attempts,
            email.subject,
            email.tenant_id is not None,
            email.initiated_by_recruiter_id is not None,
            bool(email.recipient),
            email.idempotency_key == f"application-rejection:{decided_by}",
        ),
        "email_payload": {
            name: value
            for name, value in email.payload.items()
            if name not in {"application_id", "candidate_name"}
        },
    }


async def test_a_sweep_leaves_behind_what_one_move_leaves_behind(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The set-based ending is the single move taken over a set, and nothing less.

    Nothing couples the two paths — one writes through the ORM and the other in SQL — so this is
    what says they still agree. A column one of them fills and the other forgets would be two
    Candidates told two different things by the same decision.
    """
    job, by_hand, swept = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    await a_moved_application(recruiter, by_hand["id"], ApplicationStatus.REJECTED)
    await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    assert await the_rejection_of(db_session, swept["id"]) == await the_rejection_of(
        db_session, by_hand["id"]
    )


async def test_a_sweep_moves_no_count_the_platform_keeps(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Housekeeping moves no figure: every Application the Tenant received still counts, on the
    Job's own total, on the Dashboard and in what a Tracked link converted. Only the Pipeline
    counts move, which is the sweep's own moves and nothing else."""
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])
    await an_application_through(
        other_browser, mailbox, db_session, job["id"], link["token"], "first"
    )
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "second")
    await an_accepted_application(third_browser, job["id"])

    def figures(job_view: dict[str, Any], stats: dict[str, Any], report: dict[str, Any]) -> Any:
        applications = dict(stats["applications"])
        moved = applications.pop("by_status")
        return (job_view["application_count"], applications, stats["sources"], report), moved

    before, moved_before = figures(
        await read_job(recruiter, job["id"]),
        await stats_of(recruiter),
        await link_report(recruiter, job["id"]),
    )

    swept = await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW])

    after, moved_after = figures(
        await read_job(recruiter, job["id"]),
        await stats_of(recruiter),
        await link_report(recruiter, job["id"]),
    )
    assert swept["ended"] == 2
    assert after == before
    assert moved_before["new"] == 2 and moved_before["rejected"] == 0
    assert moved_after["new"] == 0 and moved_after["rejected"] == 2
