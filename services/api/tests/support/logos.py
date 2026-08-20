from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sync_core import TENANT_LOGO_BUCKET
from tests.support.avatars import JPEG, a_photo
from tests.support.buckets import empty_bucket, stored_paths

if TYPE_CHECKING:
    import asyncpg
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Storage

LOGO: Final = "/v1/tenants/me/logo"


async def upload_logo(
    browser: AsyncClient,
    content: bytes | None = None,
    *,
    filename: str = "logo.jpg",
    media_type: str | None = JPEG,
) -> Response:
    return await browser.put(
        LOGO,
        files={"file": (filename, content if content is not None else a_photo(), media_type)},
    )


async def an_uploaded_logo(browser: AsyncClient, content: bytes | None = None) -> str:
    response = await upload_logo(browser, content)
    assert response.status_code == 200, response.text
    url: str = response.json()["logo_url"]
    return url


async def logo_paths(session: AsyncSession) -> list[str]:
    return await stored_paths(session, TENANT_LOGO_BUCKET)


async def empty_logo_bucket(connection: asyncpg.Connection, storage: Storage) -> None:
    await empty_bucket(connection, storage, TENANT_LOGO_BUCKET)
