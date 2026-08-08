from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support.jobs import (
    TENANT_JOBS,
    a_created_job,
    a_published_job,
    a_tracked_link,
    change_link,
    counted_again,
    create_link,
    follow_link,
    job_views,
    link_report,
    links_of,
    read_job,
    read_public_job,
)
from tests.support.mailbox import Mailbox
from tests.support.tenants import an_admin


async def test_a_link_lands_on_its_job_and_the_view_is_attributed_to_it(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])

    landed = await follow_link(visitor, link["token"])

    assert landed.status_code == 200, landed.text
    assert landed.json()["id"] == job["id"]
    [view] = await job_views(db_session, job["id"])
    assert str(view.tracked_link_id) == link["id"]


async def test_a_link_counts_the_traffic_it_brought(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    linked_in = await a_tracked_link(recruiter, job["id"], name="LinkedIn post")
    quiet = await a_tracked_link(recruiter, job["id"], name="Print flyer")

    await follow_link(visitor, linked_in["token"])
    await counted_again(db_session, job["id"])
    await follow_link(visitor, linked_in["token"])

    counted = {link["name"]: link["view_count"] for link in await links_of(recruiter, job["id"])}
    assert counted == {"LinkedIn post": 2, "Print flyer": 0}
    assert quiet["view_count"] == 0


async def test_landing_on_the_same_link_twice_over_is_one_view(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])

    await follow_link(visitor, link["token"])
    await follow_link(visitor, link["token"])

    assert len(await job_views(db_session, job["id"])) == 1


async def test_simultaneous_landings_on_one_link_are_one_view(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    warmup = await a_published_job(recruiter, title="Warmup")
    link = await a_tracked_link(recruiter, job["id"])
    await read_public_job(visitor, warmup["id"])

    responses = await asyncio.gather(*(follow_link(visitor, link["token"]) for _ in range(8)))

    assert {response.status_code for response in responses} == {200}
    assert len(await job_views(db_session, job["id"])) == 1


async def test_a_link_and_the_open_page_are_two_channels_of_one_job(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])

    await read_public_job(visitor, job["id"])
    await follow_link(visitor, link["token"])

    direct, tracked = await job_views(db_session, job["id"])
    assert direct.tracked_link_id is None
    assert str(tracked.tracked_link_id) == link["id"]
    assert direct.session_id == tracked.session_id


async def test_a_jobs_total_counts_the_views_no_link_brought(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    """What the Tracked links tab divides by: each link's share is of the Job's whole total, and
    Direct is what that total has over the links."""
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])

    await read_public_job(visitor, job["id"])
    await follow_link(visitor, link["token"])

    assert [item["view_count"] for item in await links_of(recruiter, job["id"])] == [1]
    assert (await read_job(recruiter, job["id"]))["view_count"] == 2


async def test_the_link_report_counts_direct_and_link_views_together(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"], name="LinkedIn post")

    await read_public_job(visitor, job["id"])
    await follow_link(visitor, link["token"])

    report = await link_report(recruiter, job["id"])
    assert report["direct_view_count"] == 1
    assert report["view_count"] == 2
    assert [(item["name"], item["view_count"]) for item in report["items"]] == [
        ("LinkedIn post", 1)
    ]


async def test_the_link_report_keeps_direct_when_there_are_no_links(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)

    await read_public_job(visitor, job["id"])

    assert await link_report(recruiter, job["id"]) == {
        "items": [],
        "direct_view_count": 1,
        "view_count": 1,
    }


async def test_a_link_that_was_turned_off_leads_nowhere(
    recruiter: AsyncClient, visitor: AsyncClient, db_session: AsyncSession
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])

    turned_off = await change_link(recruiter, job["id"], link["id"], is_active=False)

    assert turned_off.status_code == 200, turned_off.text
    assert turned_off.json()["is_active"] is False
    refused = await follow_link(visitor, link["token"])
    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:tracked-link-not-found"
    assert await job_views(db_session, job["id"]) == []


async def test_a_link_that_has_run_out_leads_nowhere(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)
    yesterday = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    link = await a_tracked_link(recruiter, job["id"], expires_at=yesterday)

    assert (await follow_link(visitor, link["token"])).status_code == 404


async def test_a_token_the_platform_never_issued_reads_the_same(visitor: AsyncClient) -> None:
    response = await follow_link(visitor, "not-a-token-anybody-was-given")

    assert response.status_code == 404, response.text
    assert response.json()["type"] == "urn:sync:problem:tracked-link-not-found"


async def test_a_link_to_a_job_that_is_not_published_leads_nowhere(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    draft = await a_created_job(recruiter)
    link = await a_tracked_link(recruiter, draft["id"])

    assert (await follow_link(visitor, link["token"])).status_code == 404


async def test_a_link_can_be_reopened_after_it_was_turned_off(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])
    await change_link(recruiter, job["id"], link["id"], is_active=False)

    await change_link(recruiter, job["id"], link["id"], is_active=True, name="LinkedIn, take two")

    assert (await follow_link(visitor, link["token"])).status_code == 200
    assert [item["name"] for item in await links_of(recruiter, job["id"])] == ["LinkedIn, take two"]


async def test_two_links_of_one_job_cannot_share_a_name(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"], name="LinkedIn post")

    refused = await create_link(recruiter, job["id"], name="LinkedIn post")

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:tracked-link-name-taken"


async def test_a_link_cannot_be_renamed_onto_a_siblings_name(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"], name="LinkedIn post")
    flyer = await a_tracked_link(recruiter, job["id"], name="Print flyer")

    refused = await change_link(recruiter, job["id"], flyer["id"], name="LinkedIn post")

    assert refused.status_code == 409, refused.text
    assert refused.json()["type"] == "urn:sync:problem:tracked-link-name-taken"
    assert [item["name"] for item in await links_of(recruiter, job["id"])] == [
        "LinkedIn post",
        "Print flyer",
    ]


async def test_another_tenant_cannot_reach_the_links(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])
    await an_admin(other_browser, mailbox, "globex")

    turning_it_off = await change_link(other_browser, job["id"], link["id"], is_active=False)

    assert (await other_browser.get(f"{TENANT_JOBS}/{job['id']}/links")).status_code == 404
    assert (await create_link(other_browser, job["id"])).status_code == 404
    assert turning_it_off.status_code == 404


async def test_a_link_of_another_job_is_not_this_jobs_link(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    other_job = await a_published_job(recruiter, title="Somewhere else")
    link = await a_tracked_link(recruiter, other_job["id"])

    refused = await change_link(recruiter, job["id"], link["id"], is_active=False)

    assert refused.status_code == 404, refused.text
    assert refused.json()["type"] == "urn:sync:problem:tracked-link-not-found"


async def test_links_are_not_managed_without_a_recruiter_session(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter)

    assert (await visitor.get(f"{TENANT_JOBS}/{job['id']}/links")).status_code == 401
