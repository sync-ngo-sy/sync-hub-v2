"""The in-app half of telling a Candidate something: what they have been told, and what they
have read."""

from sync_api.notifications.payload import Notification, NotificationPage, UnreadNotificationCount
from sync_api.notifications.service import NotificationService

__all__ = [
    "Notification",
    "NotificationPage",
    "NotificationService",
    "UnreadNotificationCount",
]
