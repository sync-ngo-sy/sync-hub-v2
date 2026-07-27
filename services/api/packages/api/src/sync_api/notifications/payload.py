"""What a notification looks like on the wire.

The payload does the talking. There is deliberately no second `type` field beside it: the
row carries one because the column is what queries and the unread index are keyed on, but a
client switching on `payload.type` and a client switching on a sibling `type` would be two
contracts for one fact, and the day they disagree is a bug nobody can see. One discriminated
union, one field to switch on.

For the same reason `application_id` is not repeated here. It is a column because
notifications are queried and cascaded by it; the payloads that are about an Application say
so themselves.
"""

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
    created_at: datetime = Field(description="When the platform recorded it.")


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
