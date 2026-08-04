from __future__ import annotations

from httpx import AsyncClient

from tests.support.jobs import (
    a_published_job,
    a_tracked_link,
    change_link,
    follow_link,
)
from tests.support.stats import TENANT_TRACKED_LINKS


async def names_in(browser: AsyncClient, **params: str) -> list[str]:
    response = await browser.get(TENANT_TRACKED_LINKS, params=params)
    assert response.status_code == 200, response.text
    return [item["name"] for item in response.json()["items"]]


async def test_a_tenant_with_no_links_lists_none(recruiter: AsyncClient) -> None:
    listed = await recruiter.get(TENANT_TRACKED_LINKS)

    assert listed.status_code == 200, listed.text
    assert listed.json() == {"items": [], "next_cursor": None}


async def test_the_list_is_refused_without_a_session(browser: AsyncClient) -> None:
    assert (await browser.get(TENANT_TRACKED_LINKS)).status_code == 401


async def test_links_from_every_job_are_in_one_list(recruiter: AsyncClient) -> None:
    """The whole point of it: a link was only ever reachable one Job at a time before."""
    field = await a_published_job(recruiter, title="Field Coordinator")
    meal = await a_published_job(recruiter, title="MEAL Officer")
    await a_tracked_link(recruiter, field["id"], name="LinkedIn post")
    await a_tracked_link(recruiter, meal["id"], name="WhatsApp groups")

    assert sorted(await names_in(recruiter)) == ["LinkedIn post", "WhatsApp groups"]


async def test_the_same_name_on_two_jobs_stays_two_rows(recruiter: AsyncClient) -> None:
    """Where the Dashboard's card merges channels by name, this list does not: each link has a
    state and a Job of its own, and a merged row would have neither."""
    for title in ("Field Coordinator", "MEAL Officer"):
        job = await a_published_job(recruiter, title=title)
        await a_tracked_link(recruiter, job["id"], name="LinkedIn post")

    assert await names_in(recruiter) == ["LinkedIn post", "LinkedIn post"]


async def test_a_row_names_its_job_and_counts_its_traffic(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    job = await a_published_job(recruiter, title="Field Coordinator")
    link = await a_tracked_link(recruiter, job["id"], name="LinkedIn post")
    await follow_link(visitor, link["token"])
    await follow_link(visitor, link["token"])

    [item] = (await recruiter.get(TENANT_TRACKED_LINKS)).json()["items"]

    assert item["job"] == {"id": job["id"], "title": "Field Coordinator"}
    assert item["view_count"] == 2
    assert item["name"] == "LinkedIn post"
    assert item["token"] == link["token"]
    assert item["is_active"] is True


async def test_a_link_nobody_followed_counts_none(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"], name="Print flyer")

    [item] = (await recruiter.get(TENANT_TRACKED_LINKS)).json()["items"]

    assert item["view_count"] == 0


async def test_the_list_is_newest_first_and_pages_by_cursor(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    for name in ("Oldest", "Middle", "Newest"):
        await a_tracked_link(recruiter, job["id"], name=name)

    first = await recruiter.get(TENANT_TRACKED_LINKS, params={"limit": 2})
    body = first.json()

    assert [item["name"] for item in body["items"]] == ["Newest", "Middle"]
    assert body["next_cursor"] is not None

    rest = await recruiter.get(
        TENANT_TRACKED_LINKS, params={"limit": 2, "cursor": body["next_cursor"]}
    )
    assert [item["name"] for item in rest.json()["items"]] == ["Oldest"]
    assert rest.json()["next_cursor"] is None


async def test_a_search_matches_part_of_a_name(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    for name in ("LinkedIn post", "LinkedIn ad", "WhatsApp groups"):
        await a_tracked_link(recruiter, job["id"], name=name)

    assert sorted(await names_in(recruiter, q="linkedin")) == ["LinkedIn ad", "LinkedIn post"]


async def test_a_search_ignores_case(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"], name="WhatsApp groups")

    assert await names_in(recruiter, q="WHATSAPP") == ["WhatsApp groups"]


async def test_a_search_that_matches_nothing_finds_nothing(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"], name="LinkedIn post")

    assert await names_in(recruiter, q="telegram") == []


async def test_a_wildcard_in_the_search_is_a_character_and_not_a_pattern(
    recruiter: AsyncClient,
) -> None:
    """`%` is a wildcard to the database and a percent sign to whoever typed it."""
    job = await a_published_job(recruiter)
    await a_tracked_link(recruiter, job["id"], name="Discount 50% campaign")
    await a_tracked_link(recruiter, job["id"], name="LinkedIn post")

    assert await names_in(recruiter, q="50%") == ["Discount 50% campaign"]
    assert await names_in(recruiter, q="%") == ["Discount 50% campaign"]


async def test_the_list_can_be_narrowed_to_the_links_still_on(recruiter: AsyncClient) -> None:
    job = await a_published_job(recruiter)
    live = await a_tracked_link(recruiter, job["id"], name="Still running")
    retired = await a_tracked_link(recruiter, job["id"], name="Spring campaign")
    await change_link(recruiter, job["id"], retired["id"], is_active=False)

    assert await names_in(recruiter, is_active="true") == [live["name"]]
    assert await names_in(recruiter, is_active="false") == [retired["name"]]


async def test_a_retired_link_is_still_in_the_list_by_default(recruiter: AsyncClient) -> None:
    """It reports; it does not tidy. A link turned off still brought the traffic it brought."""
    job = await a_published_job(recruiter)
    retired = await a_tracked_link(recruiter, job["id"], name="Spring campaign")
    await change_link(recruiter, job["id"], retired["id"], is_active=False)

    [item] = (await recruiter.get(TENANT_TRACKED_LINKS)).json()["items"]

    assert item["name"] == "Spring campaign"
    assert item["is_active"] is False


async def test_another_tenants_links_are_not_in_this_list(
    recruiter: AsyncClient, rival: AsyncClient
) -> None:
    theirs = await a_published_job(rival, title="Their role")
    await a_tracked_link(rival, theirs["id"], name="Their campaign")

    assert await names_in(recruiter) == []
    assert await names_in(rival) == ["Their campaign"]
