from __future__ import annotations

from typing import Annotated, Any, Final
from uuid import UUID

from fastapi import APIRouter, Query

from sync_api.dependencies import CurrentProfileDep, NotificationServiceDep
from sync_api.errors import openapi_problem
from sync_api.notifications import Notification, NotificationPage, UnreadNotificationCount
from sync_api.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

ROUTER_PREFIX: Final = "/notifications"

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
    """One page, newest first. Switch on each `payload.type`; page with `next_cursor`."""
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
    """Mark one read and answer with it. Idempotent: `read_at` keeps the first time it was read."""
    return await notifications.mark_read(profile.id, notification_id)
