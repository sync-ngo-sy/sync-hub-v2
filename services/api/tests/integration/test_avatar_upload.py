from __future__ import annotations

import asyncio
import io
from typing import TYPE_CHECKING, Final

from PIL import Image

from sync_api.pictures import SQUARE_PIXELS
from tests.support.avatars import (
    PNG,
    a_photo,
    an_uploaded_avatar,
    avatar_paths,
    upload_avatar,
)
from tests.support.candidates import a_deleted_account, a_signed_in_candidate
from tests.support.cvs import some_bytes

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from tests.support.mailbox import Mailbox

ORIENTATION_TAG: Final = 0x0112

ROTATE_90_CLOCKWISE_TO_DISPLAY: Final = 6


async def a_stored_photo(web: AsyncClient, url: str) -> Image.Image:
    fetched = await web.get(url)
    assert fetched.status_code == 200, fetched.text
    return Image.open(io.BytesIO(fetched.content))


async def test_the_photo_is_served_from_where_the_upload_says_it_is(
    browser: AsyncClient, mailbox: Mailbox, web: AsyncClient
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    url = await an_uploaded_avatar(browser)

    fetched = await web.get(url)
    assert fetched.status_code == 200, fetched.text
    assert fetched.headers["content-type"].startswith("image/webp")


async def test_the_stored_photo_is_one_square_webp(
    browser: AsyncClient, mailbox: Mailbox, web: AsyncClient
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    url = await an_uploaded_avatar(browser, a_photo(1600, 900))

    stored = await a_stored_photo(web, url)
    assert stored.format == "WEBP"
    assert stored.size == (SQUARE_PIXELS, SQUARE_PIXELS)


async def test_the_stored_photo_carries_no_exif(
    browser: AsyncClient, mailbox: Mailbox, web: AsyncClient
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    photographed = Image.new("RGB", (600, 600), (10, 90, 160))
    exif = photographed.getexif()
    exif[ORIENTATION_TAG] = ROTATE_90_CLOCKWISE_TO_DISPLAY
    exif[0x010F] = "A Camera Company"
    sink = io.BytesIO()
    photographed.save(sink, "JPEG", exif=exif)

    url = await an_uploaded_avatar(browser, sink.getvalue())

    stored = await a_stored_photo(web, url)
    assert dict(stored.getexif()) == {}


async def test_the_photo_lands_on_the_profile_every_portal_reads(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    url = await an_uploaded_avatar(browser)

    me = await browser.get("/v1/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["avatar_url"] == url


async def test_a_second_photo_replaces_the_first(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, web: AsyncClient
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    first = await an_uploaded_avatar(browser)

    second = await an_uploaded_avatar(browser, a_photo(colour=(20, 140, 90)))

    assert second != first
    assert len(await avatar_paths(db_session)) == 1
    assert (await web.get(first)).status_code >= 400


async def test_simultaneous_photos_leave_the_remembered_one_served(
    browser: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    web: AsyncClient,
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    responses = await asyncio.gather(
        *(upload_avatar(browser, a_photo(colour=(index * 20, 80, 120))) for index in range(1, 7))
    )

    assert {response.status_code for response in responses} == {200}
    remembered = (await browser.get("/v1/auth/me")).json()["avatar_url"]
    assert (await web.get(remembered)).status_code == 200
    paths = await avatar_paths(db_session)
    assert len(paths) == 1
    assert remembered.endswith(paths[0])


async def test_a_photo_larger_than_the_platform_takes_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_avatar(browser, b"\0" * (5 * 1024 * 1024 + 1))

    assert response.status_code == 413, response.text
    assert "5 MB or smaller" in response.json()["detail"]
    assert await avatar_paths(db_session) == []


async def test_a_file_that_is_not_a_photo_is_refused(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_avatar(browser, some_bytes(), filename="cv.pdf", media_type=None)

    assert response.status_code == 415, response.text
    assert "JPEG, PNG or WebP" in response.json()["detail"]
    assert await avatar_paths(db_session) == []


async def test_an_image_in_a_format_the_platform_does_not_take_is_refused(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_avatar(
        browser, a_photo(image_format="GIF"), filename="photo.gif", media_type=PNG
    )

    assert response.status_code == 415, response.text
    assert "JPEG, PNG or WebP" in response.json()["detail"]


async def test_an_empty_file_is_refused(browser: AsyncClient, mailbox: Mailbox) -> None:
    await a_signed_in_candidate(browser, mailbox)

    response = await upload_avatar(browser, b"")

    assert response.status_code == 422, response.text
    assert "empty" in response.json()["detail"]


async def test_only_a_candidate_can_set_a_photo(recruiter: AsyncClient) -> None:
    response = await upload_avatar(recruiter)

    assert response.status_code == 403, response.text


async def test_a_signed_out_visitor_cannot_set_a_photo(browser: AsyncClient) -> None:
    response = await upload_avatar(browser)

    assert response.status_code == 401, response.text


async def test_deleting_the_account_unpublishes_the_photo(
    browser: AsyncClient, mailbox: Mailbox, db_session: AsyncSession, web: AsyncClient
) -> None:
    await a_signed_in_candidate(browser, mailbox)
    url = await an_uploaded_avatar(browser)

    await a_deleted_account(browser)

    assert await avatar_paths(db_session) == []
    assert (await web.get(url)).status_code >= 400
