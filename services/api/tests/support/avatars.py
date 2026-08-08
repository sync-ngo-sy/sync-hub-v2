from __future__ import annotations

import io
from typing import TYPE_CHECKING, Final

from PIL import Image
from sqlalchemy import text

if TYPE_CHECKING:
    import asyncpg
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Storage

AVATAR: Final = "/v1/candidates/me/avatar"

JPEG: Final = "image/jpeg"
PNG: Final = "image/png"

A_COLOUR: Final = (200, 120, 40)


def a_photo(
    width: int = 900,
    height: int = 600,
    *,
    image_format: str = "JPEG",
    colour: tuple[int, int, int] = A_COLOUR,
) -> bytes:
    sink = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(sink, image_format)
    return sink.getvalue()


async def upload_avatar(
    browser: AsyncClient,
    content: bytes | None = None,
    *,
    filename: str = "photo.jpg",
    media_type: str | None = JPEG,
) -> Response:
    return await browser.put(
        AVATAR,
        files={"file": (filename, content if content is not None else a_photo(), media_type)},
    )


async def an_uploaded_avatar(browser: AsyncClient, content: bytes | None = None) -> str:
    response = await upload_avatar(browser, content)
    assert response.status_code == 200, response.text
    url: str = response.json()["avatar_url"]
    return url


async def avatar_paths(session: AsyncSession) -> list[str]:
    stored = await session.execute(
        text("select name from storage.objects where bucket_id = 'avatars' order by name")
    )
    return [row[0] for row in stored]


async def empty_avatar_bucket(connection: asyncpg.Connection, storage: Storage) -> None:
    stored = await connection.fetch("select name from storage.objects where bucket_id = 'avatars'")
    for row in stored:
        await storage.remove(row["name"])
