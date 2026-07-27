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
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def page(
        self, profile_id: UUID, *, cursor: str | None = None, limit: int = DEFAULT_PAGE_SIZE
    ) -> NotificationPage:
        query = (
            select(NotificationRow)
            .where(NotificationRow.recipient_profile_id == profile_id)
            .order_by(NotificationRow.created_at.desc(), NotificationRow.id.desc())
            .limit(limit + 1)
        )
        if cursor is not None:
            after = Cursor.decode(cursor)
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
        async with transaction(self._db):
            marked = await self._db.scalars(
                update(NotificationRow)
                .where(
                    NotificationRow.id == notification_id,
                    NotificationRow.recipient_profile_id == profile_id,
                )
                .values(read_at=func.coalesce(NotificationRow.read_at, func.now()))
                .returning(NotificationRow)
            )
            notification = marked.one_or_none()
            if notification is None:
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
