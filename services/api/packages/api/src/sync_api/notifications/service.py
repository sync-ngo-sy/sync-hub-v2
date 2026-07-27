"""What a Profile does with the things they have been told.

Reading only. Nothing here creates a notification: a notification is written by whatever
transaction it announces — `sync_core.notifications.notify`, called by the pipeline that
failed or the transition that happened — so there is no route a client could post one to and
no moment where the platform has said something it did not do.

Every query is scoped by the recipient, in the same statement rather than checked afterwards.
A notification is addressed to one Profile, and "somebody else's notification" has to be
indistinguishable from "no such notification" or the 404 becomes a way to ask what other
people are being told.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func, literal, select, tuple_

from sync_api.notifications.payload import Notification, NotificationPage, UnreadNotificationCount
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor
from sync_api.problems import NOTIFICATION_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core import get_logger, transaction
from sync_core.models import Notification as NotificationRow
from sync_core.notifications import payload_of

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)


class NotificationService:
    """One request's worth of one Profile's notifications."""

    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def page(
        self, profile_id: UUID, *, cursor: str | None = None, limit: int = DEFAULT_PAGE_SIZE
    ) -> NotificationPage:
        """Newest first, from the start or from where the last page ended.

        One row more than asked for is fetched and then dropped: it is the only way to know
        whether a page is the last one without a second query, and a `next_cursor` on a list
        that turns out to be empty is a client polling for ever.
        """
        query = (
            select(NotificationRow)
            .where(NotificationRow.recipient_profile_id == profile_id)
            .order_by(NotificationRow.created_at.desc(), NotificationRow.id.desc())
            .limit(limit + 1)
        )
        if cursor is not None:
            after = Cursor.decode(cursor)
            # Row comparison rather than the `or_`/`and_` spelling of the same thing: it is
            # one predicate over exactly the columns `notifications_recipient_created_idx`
            # is ordered by, which is what lets Postgres seek to the cursor's row.
            query = query.where(
                tuple_(NotificationRow.created_at, NotificationRow.id)
                < tuple_(literal(after.created_at), literal(after.id))
            )

        found = list(await self._db.scalars(query))
        rows, more = found[:limit], len(found) > limit
        return NotificationPage(
            items=_readable(rows),
            next_cursor=Cursor(created_at=rows[-1].created_at, id=rows[-1].id).encode()
            if more and rows
            else None,
        )

    async def unread_count(self, profile_id: UUID) -> UnreadNotificationCount:
        """What the bell shows. Counted in Postgres — the list is not read to answer this."""
        unread = await self._db.scalar(
            select(func.count())
            .select_from(NotificationRow)
            .where(
                NotificationRow.recipient_profile_id == profile_id,
                NotificationRow.read_at.is_(None),
            )
        )
        return UnreadNotificationCount(unread=int(unread or 0))

    async def mark_read(self, profile_id: UUID, notification_id: UUID) -> Notification:
        """Mark one notification read, and answer with it as it now stands.

        Marking a read notification read again is a no-op that keeps the original time: the
        SPA marks on render, so the same notification is marked every time the list is
        opened, and moving `read_at` forward each time would make it a "last seen" field
        under a name that promises the first.
        """
        notification = await self._own(profile_id, notification_id)
        if notification.read_at is None:
            async with transaction(self._db):
                notification.read_at = datetime.now(UTC)
        return _as_payload(notification)

    async def _own(self, profile_id: UUID, notification_id: UUID) -> NotificationRow:
        """The caller's notification, or a 404 that says nothing about whose it is."""
        notification = await self._db.scalar(
            select(NotificationRow).where(
                NotificationRow.id == notification_id,
                NotificationRow.recipient_profile_id == profile_id,
            )
        )
        if notification is None:
            raise Problem(
                status=404,
                type=NOTIFICATION_NOT_FOUND_PROBLEM_TYPE,
                detail="No notification of yours has that id.",
            )
        return notification


def _readable(rows: Sequence[NotificationRow]) -> list[Notification]:
    """The rows the API can still describe.

    A payload that no longer fits its union means the shapes moved without their data — our
    bug, and one worth a log line. The row is left out rather than allowed to 500 the whole
    list, because a bell icon that cannot open is a worse failure than a bell icon missing
    one entry.
    """
    described = []
    for row in rows:
        try:
            described.append(_as_payload(row))
        except ValueError:
            logger.error("notifications.unreadable_payload", notification_id=str(row.id))
    return described


def _as_payload(row: NotificationRow) -> Notification:
    return Notification(
        id=row.id,
        payload=payload_of(row.payload),
        read_at=row.read_at,
        created_at=row.created_at,
    )
