"""The bell icon: what the caller has been told, and saying they have read it.

No id in the path but the notification's own, and no `/me` either — a Notification is
addressed to one Profile, so the session is the only addressee there is. Not
`/candidates/me/...` for the same reason: the recipient is a Profile, and a Recruiter reading
their own (empty, for now) list is the same request, not a second endpoint.

Notifications are not posted here. They are written by the transaction whose outcome they
announce, in the worker or in a route that changed something, which is why the only write on
this surface is the caller marking one read.
"""

from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Query

from sync_api.dependencies import CurrentProfileDep, NotificationServiceDep
from sync_api.errors import openapi_problem
from sync_api.notifications import Notification, NotificationPage, UnreadNotificationCount
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

ROUTER_PREFIX: Final = "/notifications"

#: What every route here answers when nobody is signed in. There is no 403: a Notification
#: belongs to a Profile, and every Profile has a list of its own to read.
NO_SESSION: Final[dict[int | str, dict[str, Any]]] = {
    401: openapi_problem("There is no valid session."),
}

router = APIRouter(prefix=ROUTER_PREFIX, tags=["notifications"])


@router.get(
    "",
    operation_id="listMyNotifications",
    summary="The caller's notifications, newest first",
    responses={
        **NO_SESSION,
        422: openapi_problem("`cursor` is not one this API issued."),
    },
)
async def list_my_notifications(
    profile: CurrentProfileDep,
    notifications: NotificationServiceDep,
    cursor: Annotated[
        str | None,
        Query(description="A `next_cursor` from a previous page. Omit for the newest page."),
    ] = None,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many to return.")
    ] = DEFAULT_PAGE_SIZE,
) -> NotificationPage:
    """One page of what the platform has told this Profile.

    Each item's `payload` says what happened, and its `type` says which shape the payload
    takes — switch on that one field. Page by sending `next_cursor` back as `cursor`, and
    stop when it comes back null.
    """
    return await notifications.page(profile.id, cursor=cursor, limit=limit)


@router.get(
    "/unread-count",
    operation_id="getMyUnreadNotificationCount",
    summary="How many notifications the caller has not read",
    responses=NO_SESSION,
)
async def get_my_unread_notification_count(
    profile: CurrentProfileDep, notifications: NotificationServiceDep
) -> UnreadNotificationCount:
    """The number on the bell. Cheap enough to poll; it counts rather than reads the list."""
    return await notifications.unread_count(profile.id)


@router.post(
    "/{notification_id}/read",
    operation_id="markMyNotificationAsRead",
    summary="Mark one notification read",
    responses={
        **NO_SESSION,
        404: openapi_problem("The caller has no notification with that id."),
    },
)
async def mark_my_notification_as_read(
    notification_id: UUID, profile: CurrentProfileDep, notifications: NotificationServiceDep
) -> Notification:
    """Say the caller has seen this one, and answer with it as it now stands.

    Safe to send again: a notification that is already read keeps the time it was first
    read, so re-rendering a list does not turn `read_at` into "last seen".
    """
    return await notifications.mark_read(profile.id, notification_id)
