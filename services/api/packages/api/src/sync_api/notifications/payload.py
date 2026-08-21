from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from sync_core.notifications import NotificationPayload


class Notification(BaseModel):
    """One thing the caller has been told."""

    id: UUID
    payload: NotificationPayload = Field(
        description="What happened. `type` says which shape the rest of this object takes."
    )
    read_at: datetime | None = Field(
        default=None, description="When the caller read this. Null while it is still unread."
    )
    created_at: datetime = Field(
        description="When this became yours to read. The moment the platform recorded it, "
        "except for a rejection, which is recorded when the Tenant decides it and held three "
        "days — so this is the day it reached you rather than the day it was written."
    )


class NotificationPage(BaseModel):
    """One page of the caller's notifications, newest first."""

    items: list[Notification]
    next_cursor: str | None = Field(
        default=None,
        description="Send back as `cursor` for the following page. Null on the last page — "
        "which is the only thing that means there is no more to fetch.",
    )


class UnreadNotificationCount(BaseModel):
    """What the bell icon renders when nobody has opened the list."""

    unread: int = Field(description="How many of the caller's notifications are still unread.")
