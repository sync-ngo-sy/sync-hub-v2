"""What a Notification can say, and how one is written.

In `sync_core` because the two halves of the platform meet here: the worker *produces*
notifications — a parse the pipeline gave up on — and the API *reads* them back out. One set
of shapes, so a payload written by one process cannot be a payload the other cannot read.

The shapes are a discriminated union on `type`, which is the same enum the `notifications.type`
column is. That is deliberate: the column is what the unread index and every query are keyed
on, the payload is what the SPA renders, and a migration's CHECK refuses a row where the two
disagree. So there is one vocabulary for what a notification *is*, spelled once, and no way to
write a `cv_parse_failed` row carrying something else's payload.

`NotificationPayload` has one member today and is a union anyway, which is what makes `type`
mandatory in the schema and switchable in the client from the start. Adding a type is: a value
in the `notification_type` enum (a migration), a model here, a member in the union, and the
code that writes it — in one change, so no deployed reader meets a type it has never heard of.

Payloads carry ids and names, never sentences. English prose belongs to the SPA, which is what
keeps a future translation a frontend change rather than a data migration.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any, Final, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from sync_core.models import Notification, NotificationType

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class CvParseFailed(BaseModel):
    """The platform gave up on reading a CV.

    Frozen, because a payload is a record of something that already happened.

    The reason is deliberately not here. It lives on the CV itself (`parsing_error`), where it
    is one field of the document this points at, and it is written for a developer reading a
    row rather than for a candidate reading a bell.
    """

    model_config = ConfigDict(frozen=True)

    type: Literal[NotificationType.CV_PARSE_FAILED] = NotificationType.CV_PARSE_FAILED
    cv_id: UUID = Field(description="The CV that could not be read. Fetch it for the details.")
    display_name: str = Field(
        description="The name of the file the candidate uploaded, so the message can name it."
    )


#: Every shape a notification's payload can take, told apart by `type`. A client switches on
#: that one field and knows the rest of the object, which is why it is mandatory and why this
#: is a discriminated union rather than a bare model even while it has one member.
NotificationPayload = Annotated[CvParseFailed, Field(discriminator="type")]

_STORED_PAYLOAD: Final[TypeAdapter[CvParseFailed]] = TypeAdapter(NotificationPayload)


def payload_of(stored: dict[str, Any]) -> CvParseFailed:
    """Read a `notifications.payload` back into the shape its `type` names.

    Raises `pydantic.ValidationError` for a payload no member of the union admits, which can
    only mean the shapes here moved without the rows that were written against them.
    """
    return _STORED_PAYLOAD.validate_python(stored)


async def notify(
    session: AsyncSession, recipient_profile_id: UUID, payload: NotificationPayload
) -> Notification:
    """Tell one Profile that something happened. Flushed, never committed.

    The caller's transaction is the point: a notification is written *by* the transaction whose
    outcome it announces, so there is no moment where a candidate has been told about a state
    the platform then rolled back — and no queue between the two to lose it.
    """
    notification = Notification(
        recipient_profile_id=recipient_profile_id,
        type=payload.type,
        payload=payload.model_dump(mode="json"),
    )
    session.add(notification)
    await session.flush()
    return notification
