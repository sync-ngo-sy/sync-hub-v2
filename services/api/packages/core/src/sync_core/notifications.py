from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any, Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from sync_core.models import Notification, NotificationType
from sync_core.stages import ApplicationStage

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


class CvParseSucceeded(BaseModel):
    """The platform read a CV. What it found is on the CV, as `parsed_cv_data`."""

    model_config = ConfigDict(frozen=True)

    type: Literal[NotificationType.CV_PARSE_SUCCEEDED] = NotificationType.CV_PARSE_SUCCEEDED
    cv_id: UUID = Field(description="The CV that was read, and the one a draft is built from.")
    display_name: str = Field(
        description="The name of the file the candidate uploaded, so the message can name it."
    )


class ApplicationStageChanged(BaseModel):
    """An Application has reached a different Stage.

    A Tenant's internal status is not here and never will be: a Candidate hears that their
    Application is in review, not that a Recruiter moved them from shortlisted to interview
    and back again.
    """

    model_config = ConfigDict(frozen=True)

    type: Literal[NotificationType.APPLICATION_STAGE_CHANGED] = (
        NotificationType.APPLICATION_STAGE_CHANGED
    )
    application_id: UUID
    job_title: str
    tenant_name: str
    stage: ApplicationStage = Field(description="Where the Application stands now.")
    previous_stage: ApplicationStage = Field(description="Where it stood until this move.")


NotificationPayload = Annotated[
    CvParseFailed | CvParseSucceeded | ApplicationStageChanged, Field(discriminator="type")
]

_STORED_PAYLOAD: Final[TypeAdapter[NotificationPayload]] = TypeAdapter(NotificationPayload)


def payload_of(stored: dict[str, Any]) -> NotificationPayload:
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
    return payload.application_id if isinstance(payload, ApplicationStageChanged) else None
