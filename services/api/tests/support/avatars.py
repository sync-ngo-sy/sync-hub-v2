from __future__ import annotations

import io
import struct
import zlib
from typing import TYPE_CHECKING, Final

from PIL import Image

from sync_core import AVATAR_BUCKET
from tests.support.buckets import empty_bucket, stored_paths

if TYPE_CHECKING:
    import asyncpg
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Storage

AVATAR: Final = "/v1/candidates/me/avatar"

JPEG: Final = "image/jpeg"
PNG: Final = "image/png"

A_COLOUR: Final = (200, 120, 40)

A_SIDE_THE_PLATFORM_WILL_NOT_DECODE: Final = 11000

A_SIDE_PILLOW_ITSELF_CALLS_A_BOMB: Final = 20000

#: Between its own two thresholds Pillow only warns, and the platform's stricter bound is
#: what refuses the picture — so under `filterwarnings = error` the advisory is in the way.
IGNORING_PILLOWS_OWN_BOMB_WARNING: Final = "ignore::PIL.Image.DecompressionBombWarning"


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


def a_png_claiming(width: int, height: int) -> bytes:
    """A PNG whose header says it is this big, holding no pixels at all."""
    return b"\x89PNG\r\n\x1a\n" + b"".join(
        _chunk(name, payload)
        for name, payload in (
            (b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)),
            (b"IDAT", b""),
            (b"IEND", b""),
        )
    )


def _chunk(name: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + name
        + payload
        + struct.pack(">I", zlib.crc32(name + payload))
    )


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
    return await stored_paths(session, AVATAR_BUCKET)


async def empty_avatar_bucket(connection: asyncpg.Connection, storage: Storage) -> None:
    await empty_bucket(connection, storage, AVATAR_BUCKET)
