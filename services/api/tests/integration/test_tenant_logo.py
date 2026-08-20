from __future__ import annotations

import asyncio
import io
from typing import TYPE_CHECKING

from PIL import Image

from sync_api.pictures import SQUARE_PIXELS
from tests.support.applications import an_application_from_nowhere, my_applications
from tests.support.avatars import PNG, a_photo
from tests.support.cvs import some_bytes
from tests.support.jobs import a_published_job, a_tracked_link, browse, follow_link, read_public_job
from tests.support.logos import an_uploaded_logo, logo_paths, upload_logo
from tests.support.tenants import a_teammate

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox


async def test_the_logo_is_served_from_where_the_upload_says_it_is(
    recruiter: AsyncClient, web: AsyncClient
) -> None:
    url = await an_uploaded_logo(recruiter)

    fetched = await web.get(url)
    assert fetched.status_code == 200, fetched.text
    assert fetched.headers["content-type"].startswith("image/webp")


async def test_the_stored_logo_is_one_square_webp(recruiter: AsyncClient, web: AsyncClient) -> None:
    url = await an_uploaded_logo(recruiter, a_photo(1600, 900))

    fetched = await web.get(url)
    stored = Image.open(io.BytesIO(fetched.content))
    assert stored.format == "WEBP"
    assert stored.size == (SQUARE_PIXELS, SQUARE_PIXELS)


async def test_the_logo_lands_on_the_tenant_its_recruiters_read(recruiter: AsyncClient) -> None:
    url = await an_uploaded_logo(recruiter)

    mine = await recruiter.get("/v1/tenants/me")
    assert mine.status_code == 200, mine.text
    assert mine.json()["logo_url"] == url


async def test_a_tenant_with_no_logo_says_so(recruiter: AsyncClient) -> None:
    mine = await recruiter.get("/v1/tenants/me")

    assert mine.json()["logo_url"] is None


async def test_a_second_logo_replaces_the_first(
    recruiter: AsyncClient, db_session: AsyncSession, web: AsyncClient
) -> None:
    first = await an_uploaded_logo(recruiter)

    second = await an_uploaded_logo(recruiter, a_photo(colour=(20, 140, 90)))

    assert second != first
    assert len(await logo_paths(db_session)) == 1
    assert (await web.get(first)).status_code >= 400


async def test_simultaneous_logos_leave_the_remembered_one_served(
    recruiter: AsyncClient, db_session: AsyncSession, web: AsyncClient
) -> None:
    """The new object is written before the remembered one is dropped, so whatever the Tenant
    row ends up naming is an object that still answers."""
    responses = await asyncio.gather(
        *(upload_logo(recruiter, a_photo(colour=(index * 20, 80, 120))) for index in range(1, 7))
    )

    assert {response.status_code for response in responses} == {200}
    remembered = (await recruiter.get("/v1/tenants/me")).json()["logo_url"]
    assert (await web.get(remembered)).status_code == 200
    paths = await logo_paths(db_session)
    assert len(paths) == 1
    assert remembered.endswith(paths[0])


async def test_only_an_admin_of_the_tenant_may_set_it(
    recruiter: AsyncClient, other_browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_teammate(recruiter, other_browser, mailbox)

    refused = await upload_logo(other_browser)

    assert refused.status_code == 403, refused.text
    assert refused.json()["type"] == "urn:sync:problem:tenant-admin-only"


async def test_a_signed_out_visitor_cannot_set_one(browser: AsyncClient) -> None:
    refused = await upload_logo(browser)

    assert refused.status_code == 401, refused.text


async def test_a_logo_larger_than_the_platform_takes_is_refused(
    recruiter: AsyncClient, db_session: AsyncSession
) -> None:
    refused = await upload_logo(recruiter, b"\0" * (5 * 1024 * 1024 + 1))

    assert refused.status_code == 413, refused.text
    assert "5 MB or smaller" in refused.json()["detail"]
    assert await logo_paths(db_session) == []


async def test_a_file_that_is_not_an_image_is_refused(
    recruiter: AsyncClient, db_session: AsyncSession
) -> None:
    refused = await upload_logo(recruiter, some_bytes(), filename="cv.pdf", media_type=None)

    assert refused.status_code == 415, refused.text
    assert refused.json()["detail"] == "A logo has to be a JPEG, PNG or WebP image."
    assert await logo_paths(db_session) == []


async def test_an_image_in_a_format_the_platform_does_not_take_is_refused(
    recruiter: AsyncClient,
) -> None:
    refused = await upload_logo(
        recruiter, a_photo(image_format="GIF"), filename="logo.gif", media_type=PNG
    )

    assert refused.status_code == 415, refused.text


async def test_an_empty_file_is_refused(recruiter: AsyncClient) -> None:
    refused = await upload_logo(recruiter, b"")

    assert refused.status_code == 422, refused.text
    assert "empty" in refused.json()["detail"]


async def test_a_browsing_visitor_sees_it_on_the_job_card(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    url = await an_uploaded_logo(recruiter)
    await a_published_job(recruiter)

    cards = await browse(visitor)

    assert [card["tenant"]["logo_url"] for card in cards] == [url]


async def test_a_visitor_reading_the_job_sees_it(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    url = await an_uploaded_logo(recruiter)
    job = await a_published_job(recruiter)

    read = await read_public_job(visitor, job["id"])

    assert read.status_code == 200, read.text
    assert read.json()["tenant"]["logo_url"] == url


async def test_a_visitor_landing_on_a_tracked_link_sees_it(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    url = await an_uploaded_logo(recruiter)
    job = await a_published_job(recruiter)
    link = await a_tracked_link(recruiter, job["id"])

    landed = await follow_link(visitor, link["token"])

    assert landed.status_code == 200, landed.text
    assert landed.json()["tenant"]["logo_url"] == url


async def test_a_candidate_sees_it_on_the_applications_they_sent(
    recruiter: AsyncClient,
    other_browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    url = await an_uploaded_logo(recruiter)
    job = await a_published_job(recruiter)
    await an_application_from_nowhere(other_browser, mailbox, db_session, job["id"])

    rows = await my_applications(other_browser)

    assert [row["job"]["tenant"]["logo_url"] for row in rows] == [url]


async def test_a_tenant_that_has_set_none_shows_none_to_a_visitor(
    recruiter: AsyncClient, visitor: AsyncClient
) -> None:
    await a_published_job(recruiter)

    cards = await browse(visitor)

    assert [card["tenant"]["logo_url"] for card in cards] == [None]
