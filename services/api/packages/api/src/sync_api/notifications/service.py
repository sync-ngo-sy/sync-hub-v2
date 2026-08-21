from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select, update

from sync_api.notifications.payload import Notification, NotificationPage, UnreadNotificationCount
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import NOTIFICATION_NOT_FOUND_PROBLEM_TYPE, Problem
from sync_core import transaction
from sync_core.models import Notification as NotificationRow
from sync_core.notifications import payload_of

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


def _the_telling_has_come() -> ColumnElement[bool]:
    """A rejection's Notification is written at the decision and held to its Telling, so the
    bell stays silent for the three days the Recruiter's list has already cleared."""
    return or_(NotificationRow.visible_at.is_(None), NotificationRow.visible_at <= func.now())


def _reached_them() -> ColumnElement[datetime]:
    """When a Notification became the Candidate's to read, which is the only moment they can
    date it by: a rejection's is written at the decision and held three days.

    The list orders on this and the bell renders it, so a held Notification arrives at the top
    of the list on the day it arrives rather than three days down it on the day it was written.
    """
    return func.coalesce(NotificationRow.visible_at, NotificationRow.created_at)


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self._db = session

    async def page(
        self, profile_id: UUID, *, cursor: str | None = None, limit: int = DEFAULT_PAGE_SIZE
    ) -> NotificationPage:
        found = list(
            await self._db.scalars(
                newest_first(
                    select(NotificationRow).where(
                        NotificationRow.recipient_profile_id == profile_id,
                        _the_telling_has_come(),
                    ),
                    created_at=_reached_them(),
                    id_=NotificationRow.id,
                    cursor=cursor,
                    limit=limit,
                )
            )
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return NotificationPage(items=[_as_payload(row) for row in rows], next_cursor=next_cursor)

    async def unread_count(self, profile_id: UUID) -> UnreadNotificationCount:
        unread = await self._db.scalar(
            select(func.count())
            .select_from(NotificationRow)
            .where(
                NotificationRow.recipient_profile_id == profile_id,
                NotificationRow.read_at.is_(None),
                _the_telling_has_come(),
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
                    _the_telling_has_come(),
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


def _cursor(row: NotificationRow) -> Cursor:
    return Cursor(created_at=_when_it_reached(row), id=row.id)


def _as_payload(row: NotificationRow) -> Notification:
    return Notification(
        id=row.id,
        payload=payload_of(row.payload),
        read_at=row.read_at,
        created_at=_when_it_reached(row),
    )


def _when_it_reached(row: NotificationRow) -> datetime:
    """`_reached_them()` read off a row, which the page's order and its cursor have to agree
    with exactly or a page would resume somewhere it never left off."""
    return row.visible_at or row.created_at
