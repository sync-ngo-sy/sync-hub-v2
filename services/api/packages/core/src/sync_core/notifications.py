from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any, Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from sync_core.models import Notification, NotificationType

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class CvParseFailed(BaseModel):
    """The platform gave up on reading a CV. The reason is on the CV, as `parsing_error`."""

    model_config = ConfigDict(frozen=True)

    type: Literal[NotificationType.CV_PARSE_FAILED] = NotificationType.CV_PARSE_FAILED
    cv_id: UUID = Field(description="The CV that could not be read. Fetch it for the details.")
    display_name: str = Field(
        description="The name of the file the candidate uploaded, so the message can name it."
    )


NotificationPayload = Annotated[CvParseFailed, Field(discriminator="type")]

_STORED_PAYLOAD: Final[TypeAdapter[CvParseFailed]] = TypeAdapter(NotificationPayload)


def payload_of(stored: dict[str, Any]) -> CvParseFailed:
    return _STORED_PAYLOAD.validate_python(stored)


async def notify(
    session: AsyncSession, recipient_profile_id: UUID, payload: NotificationPayload
) -> Notification:
    # Flushed, never committed: the caller's transaction is what makes the notification and
    # the outcome it announces atomic.
    notification = Notification(
        recipient_profile_id=recipient_profile_id,
        type=payload.type,
        payload=payload.model_dump(mode="json"),
    )
    session.add(notification)
    await session.flush()
    return notification
