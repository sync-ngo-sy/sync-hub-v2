from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from sync_core.models import ApplicationStatus, QualificationStatus
from tests.support.applications import (
    a_candidate_who_can_apply,
    an_accepted_application,
    an_application_from_nowhere,
    an_application_through,
)
from tests.support.candidates import a_signed_in_candidate
from tests.support.jobs import (
    a_created_job,
    a_published_job,
    a_tracked_link,
    an_application,
    change_job,
    change_link,
    counted_again,
    follow_link,
    read_public_job,
)
from tests.support.mailbox import Mailbox
from tests.support.profiles import my_id
from tests.support.stats import (
    decide,
    published_days_ago,
    read_stats,
    received_days_ago,
    stats_of,
)

NO_JOBS = {
    "total": 0,
    "published": 0,
    "draft": 0,
    "closed": 0,
    "archived": 0,
    "published_last_week": 0,
}

NO_STATUSES = {
    "new": 0,
    "reviewing": 0,
    "shortlisted": 0,
    "interview": 0,
    "offer": 0,
    "hired": 0,
    "rejected": 0,
    "withdrawn": 0,
}

NO_VERDICTS = {"pending": 0, "qualified": 0, "disqualified": 0, "review_required": 0}


async def test_a_tenant_with_nothing_in_it_counts_nothing(recruiter: AsyncClient) -> None:
    stats = await stats_of(recruiter)

    assert stats["jobs"] == NO_JOBS
    assert stats["applications"]["total"] == 0
    assert stats["applications"]["by_status"] == NO_STATUSES
    assert stats["applications"]["by_qualification"] == NO_VERDICTS
    assert stats["sources"] == []
    assert stats["sources_total"] == 0


async def test_nobody_screened_is_no_pass_rate_rather_than_zero(recruiter: AsyncClient) -> None:
    """A rate over nothing says nothing, and 0% would say something false."""
    stats = await stats_of(recruiter)

    assert stats["applications"]["pass_rate"] is None


async def test_stats_are_refused_without_a_session(browser: AsyncClient) -> None:
    assert (await read_stats(browser)).status_code == 401


async def test_jobs_are_counted_by_the_state_they_are_in(
    recruiter: AsyncClient, mailbox: Mailbox
) -> None:
    await a_created_job(recruiter, title="Still being written")
    await a_published_job(recruiter, title="Open")
    closed = await a_published_job(recruiter, title="Decided")
    await change_job(recruiter, closed["id"], status="closed")
    archived = await a_created_job(recruiter, title="Abandoned")
    await change_job(recruiter, archived["id"], status="archived")

    stats = await stats_of(recruiter)

    assert stats["jobs"]["total"] == 4
    assert stats["jobs"]["draft"] == 1
    assert stats["jobs"]["published"] == 1
    assert stats["jobs"]["closed"] == 1
    assert stats["jobs"]["archived"] == 1


async def test_only_jobs_that_went_live_this_week_count_as_this_weeks(
    recruiter: AsyncClient, db_session: AsyncSession
) -> None:
    recent = await a_published_job(recruiter, title="Opened on Monday")
    old = await a_published_job(recruiter, title="Opened in the spring")
    await published_days_ago(db_session, recent["id"], 2)
    await published_days_ago(db_session, old["id"], 30)

    stats = await stats_of(recruiter)

    assert stats["jobs"]["published"] == 2
    assert stats["jobs"]["published_last_week"] == 1


async def test_a_draft_never_counts_as_opened_however_recently_it_was_written(
    recruiter: AsyncClient,
) -> None:
    """The whole reason `published_at` exists: `created_at` would count this one."""
    await a_created_job(recruiter, title="Written today, live never")

    stats = await stats_of(recruiter)

    assert stats["jobs"]["published_last_week"] == 0


async def test_applications_are_counted_into_rolling_windows(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_signed_in_candidate(other_browser, mailbox)
    candidate = await my_id(other_browser)
    ages = {"this morning": 0.1, "midweek": 3, "last week": 10, "last month": 20}
    for title, days in ages.items():
        job = await a_published_job(recruiter, title=title)
        application = await an_application(db_session, job["id"], candidate)
        await received_days_ago(db_session, application, days)

    stats = (await stats_of(recruiter))["applications"]

    assert stats["total"] == 4
    assert stats["last_24h"] == 1
    assert stats["last_7d"] == 2
    assert stats["previous_7d"] == 1


async def test_every_pipeline_status_is_reported_and_the_parts_sum_to_the_total(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    await a_signed_in_candidate(other_browser, mailbox)
    candidate = await my_id(other_browser)
    statuses = [
        ApplicationStatus.REVIEWING,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
    ]
    for status in statuses:
        job = await a_published_job(recruiter, title=f"Hiring a {status.value}")
        application = await an_application(db_session, job["id"], candidate)
        await decide(db_session, application, status=status)
    untouched = await a_published_job(recruiter, title="Nobody has looked")
    await an_application(db_session, untouched["id"], candidate)

    stats = (await stats_of(recruiter))["applications"]

    assert stats["by_status"] == {
        **NO_STATUSES,
        "new": 1,
        "reviewing": 1,
        "interview": 1,
        "rejected": 1,
        "withdrawn": 1,
    }
    assert sum(stats["by_status"].values()) == stats["total"] == 5


async def test_a_withdrawn_application_was_still_received_that_week(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """The window counts arrivals. A count that shrinks when somebody withdraws would make
    "applications this week" move backwards for reasons nobody could see."""
    await a_signed_in_candidate(other_browser, mailbox)
    job = await a_published_job(recruiter)
    application = await an_application(db_session, job["id"], await my_id(other_browser))
    await decide(db_session, application, status=ApplicationStatus.WITHDRAWN)

    stats = (await stats_of(recruiter))["applications"]

    assert stats["last_7d"] == 1
    assert stats["total"] == 1


async def test_the_pass_rate_is_over_what_screening_actually_decided(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Two of three verdicts qualified. The fourth Application is still pending, and a pending
    one is not a failure — counting it as one would report 50%."""
    await a_signed_in_candidate(other_browser, mailbox)
    candidate = await my_id(other_browser)
    verdicts = [
        QualificationStatus.QUALIFIED,
        QualificationStatus.QUALIFIED,
        QualificationStatus.DISQUALIFIED,
        QualificationStatus.PENDING,
    ]
    for position, verdict in enumerate(verdicts):
        job = await a_published_job(recruiter, title=f"Role {position}")
        application = await an_application(db_session, job["id"], candidate)
        await decide(db_session, application, qualification_status=verdict)

    stats = (await stats_of(recruiter))["applications"]

    assert stats["by_qualification"] == {
        "qualified": 2,
        "disqualified": 1,
        "pending": 1,
        "review_required": 0,
    }
    assert stats["pass_rate"] == 67


async def test_a_channel_is_one_row_however_many_jobs_it_was_used_on(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    """A link name is unique per Job, not per Tenant, so the same campaign on nine Jobs is nine
    rows in the table and one channel in the answer."""
    for title in ("Field Coordinator", "MEAL Officer"):
        job = await a_published_job(recruiter, title=title)
        link = await a_tracked_link(recruiter, job["id"], name="LinkedIn post")
        await follow_link(visitor, link["token"])

    stats = await stats_of(recruiter)

    assert stats["sources"] == [
        {"name": "LinkedIn post", "views": 2, "applications": 0, "conversion_rate": 0}
    ]
    assert stats["sources_total"] == 1


async def test_channels_are_ranked_by_the_traffic_they_brought(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    loud = await a_tracked_link(recruiter, job["id"], name="WhatsApp groups")
    quiet = await a_tracked_link(recruiter, job["id"], name="Print flyer")
    for _ in range(3):
        await follow_link(visitor, loud["token"])
        await counted_again(db_session, job["id"])
    await follow_link(visitor, quiet["token"])

    stats = await stats_of(recruiter)

    assert stats["sources"] == [
        {"name": "WhatsApp groups", "views": 3, "applications": 0, "conversion_rate": 0},
        {"name": "Print flyer", "views": 1, "applications": 0, "conversion_rate": 0},
    ]


async def test_visitors_who_arrived_without_a_link_are_their_own_row(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    """Otherwise tracked links read as all of the traffic, when they may be a fraction of it."""
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"], name="LinkedIn post")
    await follow_link(visitor, link["token"])
    await read_public_job(visitor, job["id"])
    await counted_again(db_session, job["id"])
    await read_public_job(visitor, job["id"])

    stats = await stats_of(recruiter)

    assert stats["sources"] == [
        {"name": "Direct", "views": 2, "applications": 0, "conversion_rate": 0},
        {"name": "LinkedIn post", "views": 1, "applications": 0, "conversion_rate": 0},
    ]
    assert stats["sources_total"] == 2


async def test_a_channel_counts_the_applications_it_brought_across_every_job(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """One campaign on two Jobs is one channel here, so what it brought is added up the same way
    its views are."""
    await a_candidate_who_can_apply(other_browser, mailbox, db_session)
    for title in ("Field Coordinator", "MEAL Officer"):
        job = await a_published_job(recruiter, title=title)
        link = await a_tracked_link(recruiter, job["id"], name="LinkedIn post")
        assert (await follow_link(other_browser, link["token"])).status_code == 200
        await an_accepted_application(other_browser, job["id"])

    stats = await stats_of(recruiter)

    assert stats["sources"] == [
        {"name": "LinkedIn post", "views": 2, "applications": 2, "conversion_rate": 100}
    ]


async def test_the_applications_no_link_brought_belong_to_direct(
    recruiter: AsyncClient,
    visitor: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"], name="LinkedIn post")
    await follow_link(visitor, link["token"])
    await an_application_from_nowhere(other_browser, mailbox, db_session, job["id"])

    stats = await stats_of(recruiter)

    assert stats["sources"] == [
        {"name": "Direct", "views": 1, "applications": 1, "conversion_rate": 100},
        {"name": "LinkedIn post", "views": 1, "applications": 0, "conversion_rate": 0},
    ]


async def test_the_channels_are_ranked_by_traffic_and_never_by_the_rate(
    recruiter: AsyncClient,
    visitor: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """One view and one Application converts at a hundred percent and says nothing. Ranking on
    that would hand the card to whichever channel nobody has read yet."""
    job = await a_published_job(recruiter)
    loud = await a_tracked_link(recruiter, job["id"], name="WhatsApp groups")
    narrow = await a_tracked_link(recruiter, job["id"], name="Alumni list")
    for _ in range(3):
        await follow_link(visitor, loud["token"])
        await counted_again(db_session, job["id"])
    await an_application_through(other_browser, mailbox, db_session, job["id"], narrow["token"])

    stats = await stats_of(recruiter)

    assert [
        (source["name"], source["views"], source["conversion_rate"]) for source in stats["sources"]
    ] == [("WhatsApp groups", 3, 0), ("Alumni list", 1, 100)]


async def test_a_tenant_nobody_has_visited_has_no_direct_row(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    """A link a Recruiter made exists even at zero views. Traffic that never arrived does not."""
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"], name="Print flyer")

    stats = await stats_of(recruiter)

    assert stats["sources"] == [
        {"name": "Print flyer", "views": 0, "applications": 0, "conversion_rate": None}
    ]
    assert stats["sources_total"] == 1


async def test_a_retired_link_keeps_the_traffic_it_brought(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    """History does not shrink because somebody turned a link off."""
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"], name="Spring campaign")
    await follow_link(visitor, link["token"])
    await change_link(recruiter, job["id"], link["id"], is_active=False)

    stats = await stats_of(recruiter)

    assert stats["sources"] == [
        {"name": "Spring campaign", "views": 1, "applications": 0, "conversion_rate": 0}
    ]


async def test_the_card_gets_six_channels_and_is_told_how_many_there_are(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    for position in range(7):
        link = await a_tracked_link(recruiter, job["id"], name=f"Channel {position}")
        for _ in range(7 - position):
            await follow_link(visitor, link["token"])
            await counted_again(db_session, job["id"])

    stats = await stats_of(recruiter)

    assert [source["name"] for source in stats["sources"]] == [
        f"Channel {position}" for position in range(6)
    ]
    assert stats["sources_total"] == 7


async def test_another_tenants_numbers_are_not_in_these_ones(
    recruiter: AsyncClient,
    rival: AsyncClient,
    visitor: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    theirs = await a_published_job(rival, title="Their role")
    link = await a_tracked_link(rival, theirs["id"], name="Their campaign")
    await follow_link(visitor, link["token"])
    await a_signed_in_candidate(other_browser, mailbox)
    await an_application(db_session, theirs["id"], await my_id(other_browser))

    stats = await stats_of(recruiter)

    assert stats["jobs"] == NO_JOBS
    assert stats["applications"]["total"] == 0
    assert stats["sources"] == []
    assert stats["sources_total"] == 0


async def test_the_seam_between_this_week_and_the_one_before_holds(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    """Either side of the seven-day mark, hours apart. Each window claims exactly one, and the
    two together claim both — an overlap would double-count and a gap would lose one."""
    await a_signed_in_candidate(other_browser, mailbox)
    candidate = await my_id(other_browser)
    for title, days in {"just inside": 6.9, "just outside": 7.1}.items():
        job = await a_published_job(recruiter, title=title)
        application = await an_application(db_session, job["id"], candidate)
        await received_days_ago(db_session, application, days)

    stats = (await stats_of(recruiter))["applications"]

    assert stats["last_7d"] == 1
    assert stats["previous_7d"] == 1
    assert stats["total"] == 2
