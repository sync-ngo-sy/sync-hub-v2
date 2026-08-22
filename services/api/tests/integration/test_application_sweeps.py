from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.communications import ApplicationRejection, payload_of
from sync_core.models import (
    ApplicationStatus,
    Communication,
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
    a_swept_tenant,
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
    sweep_the_tenant,
    the_telling_comes,
)
from tests.support.jobs import a_published_job, a_tracked_link, link_report, read_job
from tests.support.mailbox import Mailbox
from tests.support.notifications import my_notifications, my_unread_count
from tests.support.stats import decide, stats_of
from tests.support.tenants import an_admin

UNDECIDED = ["new", "reviewing", "shortlisted", "interview", "offer"]


async def rejections_of(session: AsyncSession, application_id: str) -> list[Communication]:
    """Only the rejection emails. Applying queues a confirmation of its own, so an Application
    that was never rejected still has a Communication against it."""
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

    assert swept["moved"] == 1
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

    assert swept["moved"] == 2
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

    assert swept["moved"] == 1
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

    assert swept["moved"] == 1
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

    assert ended["moved"] == 2
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

    assert swept["moved"] == 0
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
    assert swept["moved"] == 2
    assert after == before
    assert moved_before["new"] == 2 and moved_before["rejected"] == 0
    assert moved_after["new"] == 0 and moved_after["rejected"] == 2


async def test_a_sweep_along_the_ladder_moves_them_all_and_tells_nobody(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The four rungs above `new` are one Stage to the Candidate, so moving between them is
    silent: no Notification, no email, and no Telling to hold either to."""
    job, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )
    await a_moved_application(recruiter, first["id"], ApplicationStatus.REVIEWING)
    await a_moved_application(recruiter, second["id"], ApplicationStatus.REVIEWING)
    before = len(await notifications_of(db_session, first["id"]))

    swept = await a_swept_job(
        recruiter,
        job["id"],
        [ApplicationStatus.REVIEWING],
        to=ApplicationStatus.SHORTLISTED,
    )

    assert swept["moved"] == 2
    assert swept["told_at"] is None
    listed = statuses_of(await job_applications_of(recruiter, job["id"], status=UNDECIDED))
    assert listed == {first["id"]: "shortlisted", second["id"]: "shortlisted"}
    assert len(await notifications_of(db_session, first["id"])) == before
    assert await rejections_of(db_session, first["id"]) == []


async def test_a_sweep_off_new_tells_them_their_application_is_in_review(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The one ladder step that crosses a Stage boundary, and the only thing it sends."""
    job, applied, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    await a_swept_job(
        recruiter, job["id"], [ApplicationStatus.NEW], to=ApplicationStatus.SHORTLISTED
    )

    told = await notifications_of(db_session, applied["id"])
    assert [one.payload["stage"] for one in told] == ["in_review"]
    assert [one.payload["previous_stage"] for one in told] == ["received"]
    assert told[0].visible_at is None
    assert await rejections_of(db_session, applied["id"]) == []


async def test_a_sweep_along_the_ladder_records_the_move_it_really_made(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job, applied, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    await a_swept_job(recruiter, job["id"], [ApplicationStatus.NEW], to=ApplicationStatus.INTERVIEW)

    history = await status_history_of(db_session, applied["id"])
    assert (history[-1].previous_status, history[-1].new_status) == (
        ApplicationStatus.NEW,
        ApplicationStatus.INTERVIEW,
    )
    assert history[-1].change_source is StatusChangeSource.RECRUITER


async def test_a_sweep_will_not_send_a_set_where_a_set_cannot_go(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """A hire names the day it started and `new` is where an Application arrives, so neither is
    somewhere one act over many Applications can send them."""
    job, _, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    for refused in (ApplicationStatus.HIRED, ApplicationStatus.NEW, ApplicationStatus.WITHDRAWN):
        response = await sweep_the_job(
            recruiter, job["id"], [ApplicationStatus.REVIEWING], to=refused
        )
        assert response.status_code == 422, response.text


async def test_a_sweep_refuses_to_move_them_where_they_already_are(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The rule the portal's own ticks lean on, refused at the boundary rather than passed to the
    pipeline as a no-op."""
    job, _, _ = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    response = await sweep_the_job(
        recruiter,
        job["id"],
        [ApplicationStatus.NEW, ApplicationStatus.SHORTLISTED],
        to=ApplicationStatus.SHORTLISTED,
    )

    assert response.status_code == 422, response.text


async def test_a_tenant_wide_sweep_reaches_every_job_it_is_hiring_for(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """What a Job's own sweep cannot say: one act across the whole pipeline."""
    here = await a_published_job(recruiter)
    there = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session, "first")
    one = await an_accepted_application(other_browser, here["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "second")
    other = await an_accepted_application(third_browser, there["id"])

    swept = await a_swept_tenant(
        recruiter, [ApplicationStatus.NEW], to=ApplicationStatus.SHORTLISTED
    )

    assert swept["moved"] == 2
    assert (await stored_application(db_session, one["id"])).status is (
        ApplicationStatus.SHORTLISTED
    )
    assert (await stored_application(db_session, other["id"])).status is (
        ApplicationStatus.SHORTLISTED
    )


async def test_a_tenant_wide_sweep_names_each_job_by_its_own_title(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The title is read per row off a join, because a sweep across every Job spans as many
    titles as it does Jobs."""
    here = await a_published_job(recruiter, title="Field Coordinator")
    there = await a_published_job(recruiter, title="Logistics Officer")
    await a_candidate_who_can_apply(other_browser, mailbox, db_session, "first")
    one = await an_accepted_application(other_browser, here["id"])
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "second")
    other = await an_accepted_application(third_browser, there["id"])

    await a_swept_tenant(recruiter, [ApplicationStatus.NEW], to=ApplicationStatus.REVIEWING)

    told = await notifications_of(db_session, one["id"])
    assert told[-1].payload["job_title"] == "Field Coordinator"
    also = await notifications_of(db_session, other["id"])
    assert also[-1].payload["job_title"] == "Logistics Officer"


async def test_a_tenant_wide_sweep_leaves_another_tenants_applications_alone(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Every Job the Tenant is hiring for, and not one belonging to anybody else.

    Read from the rival's side, because the Recruiter and the browser signing in as the rival are
    one client: becoming somebody else is a one-way trip, so the sweep under test is theirs and
    the Application that must survive it is ours.
    """
    mine = await a_published_job(recruiter)
    await a_candidate_who_can_apply(other_browser, mailbox, db_session, "first")
    untouched = await an_accepted_application(other_browser, mine["id"])

    await an_admin(recruiter, mailbox, "rival")
    theirs = await a_published_job(recruiter)
    await a_candidate_who_can_apply(third_browser, mailbox, db_session, "second")
    ours = await an_accepted_application(third_browser, theirs["id"])

    swept = await a_swept_tenant(recruiter, [ApplicationStatus.NEW])

    assert swept["moved"] == 1
    assert (await stored_application(db_session, ours["id"])).status is ApplicationStatus.REJECTED
    assert (await stored_application(db_session, untouched["id"])).status is ApplicationStatus.NEW


async def test_a_tenant_wide_sweep_ends_them_on_one_telling_like_a_jobs_own_does(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    third_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    _, first, second = await a_job_two_people_applied_to(
        recruiter, other_browser, third_browser, mailbox, db_session
    )

    swept = await a_swept_tenant(recruiter, [ApplicationStatus.NEW])

    assert swept["moved"] == 2
    told = datetime.fromisoformat(swept["told_at"])
    assert told - datetime.now(UTC) > TELLING_DELAY - timedelta(minutes=1)
    for each in (first, second):
        queued = await rejections_of(db_session, each["id"])
        assert len(queued) == 1
        assert queued[0].available_at == told


async def test_a_tenant_wide_sweep_that_matches_nothing_is_no_error(
    recruiter: AsyncClient,
) -> None:
    swept = await a_swept_tenant(recruiter, [ApplicationStatus.OFFER])

    assert swept == {"moved": 0, "told_at": None}


async def test_sweeping_the_whole_tenant_is_only_for_recruiters(
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_candidate_who_can_apply(other_browser, mailbox, db_session, "first")

    refused = await sweep_the_tenant(other_browser, [ApplicationStatus.NEW])

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == "urn:sync:problem:recruiter-only"
