from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any, Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from sync_core.models import ApplicationStatus, Notification, NotificationType

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


class ApplicationStatusChanged(BaseModel):
    """An Application has moved. Every move produces one of these, whoever caused it."""

    model_config = ConfigDict(frozen=True)

    type: Literal[NotificationType.APPLICATION_STATUS_CHANGED] = (
        NotificationType.APPLICATION_STATUS_CHANGED
    )
    application_id: UUID
    job_title: str
    tenant_name: str
    status: ApplicationStatus = Field(description="Where the Application stands now.")
    previous_status: ApplicationStatus = Field(description="Where it stood until this move.")


NotificationPayload = Annotated[
    CvParseFailed | ApplicationStatusChanged, Field(discriminator="type")
]

_STORED_PAYLOAD: Final[TypeAdapter[CvParseFailed | ApplicationStatusChanged]] = TypeAdapter(
    NotificationPayload
)


def payload_of(stored: dict[str, Any]) -> CvParseFailed | ApplicationStatusChanged:
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
        application_id=_application_of(payload),
    )
    session.add(notification)
    await session.flush()
    return notification


def _application_of(payload: NotificationPayload) -> UUID | None:
    """The queryable column, filled from the payload so the two cannot disagree."""
    return payload.application_id if isinstance(payload, ApplicationStatusChanged) else None
