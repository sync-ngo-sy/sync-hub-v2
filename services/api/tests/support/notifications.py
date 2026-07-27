from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final

from sync_parsers import UnreadableCvError
from tests.support.cvs import an_uploaded_cv, some_bytes
from tests.support.extractors import FakeExtractor
from tests.support.worker import an_ingestion_worker

if TYPE_CHECKING:
    from httpx import AsyncClient, Response

    from sync_core import Database, Storage

NOTIFICATIONS: Final = "/v1/notifications"

UNREADABLE: Final = "this is a photograph of a cat"


async def my_notifications(browser: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await browser.get(NOTIFICATIONS, params=params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


async def my_unread_count(browser: AsyncClient) -> int:
    response = await browser.get(f"{NOTIFICATIONS}/unread-count")
    assert response.status_code == 200, response.text
    unread: int = response.json()["unread"]
    return unread


async def mark_read(browser: AsyncClient, notification_id: str) -> Response:
    return await browser.post(f"{NOTIFICATIONS}/{notification_id}/read")


async def failed_parses(
    browser: AsyncClient, database: Database, storage: Storage, how_many: int = 1
) -> list[dict[str, Any]]:
    cvs = [
        await an_uploaded_cv(browser, some_bytes(f"unreadable-{index}"))
        for index in range(how_many)
    ]
    worker = an_ingestion_worker(database, storage, FakeExtractor(UnreadableCvError(UNREADABLE)))
    for _ in cvs:
        assert await worker.run_once() is True, "the queue ran dry before every CV had failed"
    return cvs
