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

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func, literal, select, tuple_, update

from sync_api.notifications.payload import Notification, NotificationPage, UnreadNotificationCount
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor
from sync_api.problems import NOTIFICATION_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core import transaction
from sync_core.models import Notification as NotificationRow
from sync_core.notifications import payload_of

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


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
            items=[_as_payload(row) for row in rows],
            next_cursor=Cursor(created_at=rows[-1].created_at, id=rows[-1].id).encode()
            if more
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

        Marking a read notification read again keeps the original time. `coalesce` rather than
        reading the row and deciding in Python: the SPA marks on render, so the same
        notification is marked every time the list is opened — often twice at once — and two
        requests that both found `read_at` empty would both write, turning it into a "last
        seen" field under a name that promises the first. One statement cannot race itself.
        """
        async with transaction(self._db):
            marked = await self._db.scalars(
                update(NotificationRow)
                .where(
                    NotificationRow.id == notification_id,
                    # Scoped in the statement, so the update itself cannot reach somebody
                    # else's row — not even for the moment before a check would refuse it.
                    NotificationRow.recipient_profile_id == profile_id,
                )
                .values(read_at=func.coalesce(NotificationRow.read_at, func.now()))
                .returning(NotificationRow)
            )
            notification = marked.one_or_none()
            if notification is None:
                # Nothing was updated, so the caller has no notification with that id.
                # Whether somebody else does is deliberately not said.
                raise Problem(
                    status=404,
                    type=NOTIFICATION_NOT_FOUND_PROBLEM_TYPE,
                    detail="No notification of yours has that id.",
                )
        return _as_payload(notification)


def _as_payload(row: NotificationRow) -> Notification:
    return Notification(
        id=row.id,
        payload=payload_of(row.payload),
        read_at=row.read_at,
        created_at=row.created_at,
    )
