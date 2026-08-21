from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import chain
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import Text, cast, func, insert, literal, select, update
from sqlalchemy.dialects.postgresql import JSONB

from sync_api.applications.pipeline import MOVES, UNDECIDED
from sync_core.communications import REJECTION_KEY_PREFIX, ApplicationRejection
from sync_core.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Communication,
    CommunicationChannel,
    CommunicationType,
    Notification,
    NotificationType,
    Profile,
    StatusChangeSource,
    Tenant,
    User,
)
from sync_core.notifications import ApplicationStageChanged
from sync_core.stages import stage_of
from sync_core.telling import the_telling_after

if TYPE_CHECKING:
    from collections.abc import Collection

    from pydantic import BaseModel
    from sqlalchemy import ColumnElement
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core.models import Job, QualificationStatus

#: The Application every payload below names is the row's own, filled in by the statement rather
#: than by the model. Each model is built around this one and its dump leaves it out, so it
#: reaches no row — what it buys is that every other field of the payload is still model-checked.
_FILLED_IN_PER_ROW: Final = UUID(int=0)

# A set-based ending is the pipeline's own rejection taken over a set, so it may only end what a
# Recruiter can end one at a time. A `MOVES` that stopped allowing one of those would leave this
# writing histories the state machine refuses, so the module refuses to import instead — the same
# guard `sync_api.applications.pipeline` keeps over the one exit from `rejected`.
_UNENDABLE = {
    state.value
    for state in UNDECIDED
    if ApplicationStatus.REJECTED not in MOVES[StatusChangeSource.RECRUITER][state]
}
if _UNENDABLE:  # pragma: no cover — the module refuses to import instead
    raise RuntimeError(f"a recruiter can no longer reject {sorted(_UNENDABLE)} one at a time")


@dataclass(frozen=True, slots=True)
class Ended:
    """What one set-based ending did: how many Applications it moved, and the one Telling they
    all now carry. No Telling where it moved nothing — nobody is waiting to be told."""

    count: int
    told_at: datetime | None


async def end_them_all(
    session: AsyncSession,
    job: Job,
    *,
    statuses: Collection[ApplicationStatus],
    qualification_statuses: Collection[QualificationStatus] | None = None,
    by: UUID,
) -> Ended:
    """End every Application of the Job standing in one of `statuses`, set-based.

    One statement per status ticked, whatever those statuses hold: twelve Applications and fifty
    thousand cost the same, because nothing here reads a row into Python. Each statement moves
    its rows, appends their histories, writes their Notifications and queues their emails
    together, so no Application ends without the three things that tell the Candidate it did.

    Every ending is a rejection held to its Telling, exactly as a single move is: one `told_at`
    for the whole set, and the same moment on every Notification and queued email. Undoing it is
    reading the rejections back and moving them, which the single-move path already answers.

    No transaction of its own: the caller's is what keeps a half-ended list from being a state
    anybody can land in.
    """
    telling = the_telling_after(datetime.now(UTC))
    tenant_name = await session.scalar(select(Tenant.name).where(Tenant.id == job.tenant_id))
    ended = 0
    for previous in sorted(statuses, key=lambda status: status.value):
        ended += await _end_those_in(
            session,
            previous,
            job=job,
            tenant_name=tenant_name or "",
            qualification_statuses=qualification_statuses,
            by=by,
            telling=telling,
        )
    return Ended(count=ended, told_at=telling if ended else None)


async def _end_those_in(
    session: AsyncSession,
    previous: ApplicationStatus,
    *,
    job: Job,
    tenant_name: str,
    qualification_statuses: Collection[QualificationStatus] | None,
    by: UUID,
    telling: datetime,
) -> int:
    """One statement, for one status the ticks named: the moves, their histories, the bells and
    the emails.

    The `UPDATE` is what decides which Applications took part, and everything else reads its
    `RETURNING` rather than a `SELECT` of its own. So an Application somebody hired between this
    statement's snapshot and its own row lock is left alone whole, rather than rejected with a
    history, a Notification and an email standing behind it.
    """
    narrowing = (
        [Application.qualification_status.in_(qualification_statuses)]
        if qualification_statuses is not None
        else []
    )
    moved = (
        update(Application)
        .where(
            Application.tenant_id == job.tenant_id,
            Application.job_id == job.id,
            Application.status == previous,
            *narrowing,
        )
        .values(status=ApplicationStatus.REJECTED, told_at=telling)
        .returning(Application.id.label("id"), Application.candidate_id.label("candidate_id"))
        .cte("moved")
    )
    recorded = (
        insert(ApplicationStatusHistory)
        .from_select(
            [
                "application_id",
                "change_source",
                "changed_by_profile_id",
                "previous_status",
                "new_status",
            ],
            select(
                moved.c.id,
                _of(StatusChangeSource.RECRUITER, ApplicationStatusHistory.change_source),
                _of(by, ApplicationStatusHistory.changed_by_profile_id),
                _of(previous, ApplicationStatusHistory.previous_status),
                _of(ApplicationStatus.REJECTED, ApplicationStatusHistory.new_status),
            ),
        )
        .returning(
            ApplicationStatusHistory.id.label("id"),
            ApplicationStatusHistory.application_id.label("application_id"),
        )
        .cte("recorded")
    )
    told = (
        insert(Notification)
        .from_select(
            ["recipient_profile_id", "type", "payload", "application_id", "visible_at"],
            select(
                moved.c.candidate_id,
                _of(NotificationType.APPLICATION_STAGE_CHANGED, Notification.type),
                _payload(
                    ApplicationStageChanged(
                        application_id=_FILLED_IN_PER_ROW,
                        job_title=job.title,
                        tenant_name=tenant_name,
                        stage=stage_of(ApplicationStatus.REJECTED),
                        previous_stage=stage_of(previous),
                    ),
                    application_id=moved.c.id,
                ),
                moved.c.id,
                _of(telling, Notification.visible_at),
            ),
        )
        .returning(Notification.id)
        .cte("told")
    )
    queued = (
        insert(Communication)
        .from_select(
            [
                "candidate_id",
                "tenant_id",
                "application_id",
                "initiated_by_recruiter_id",
                "channel",
                "communication_type",
                "recipient",
                "payload",
                "template_key",
                "idempotency_key",
                "available_at",
            ],
            select(
                moved.c.candidate_id,
                _of(job.tenant_id, Communication.tenant_id),
                recorded.c.application_id,
                _of(by, Communication.initiated_by_recruiter_id),
                _of(CommunicationChannel.EMAIL, Communication.channel),
                _of(CommunicationType.APPLICATION_REJECTION, Communication.communication_type),
                func.coalesce(User.email, _text("")),
                _payload(
                    ApplicationRejection(
                        application_id=_FILLED_IN_PER_ROW,
                        job_title=job.title,
                        tenant_name=tenant_name,
                        candidate_name="",
                    ),
                    application_id=recorded.c.application_id,
                    candidate_name=Profile.full_name,
                ),
                _text(ApplicationRejection.template_key),
                _text(REJECTION_KEY_PREFIX).concat(cast(recorded.c.id, Text)),
                _of(telling, Communication.available_at),
            )
            .select_from(recorded)
            .join(moved, moved.c.id == recorded.c.application_id)
            .join(Profile, Profile.id == moved.c.candidate_id)
            .outerjoin(User, User.id == moved.c.candidate_id),
        )
        .returning(Communication.id)
        .cte("queued")
    )

    ended = await session.scalar(
        select(func.count()).select_from(moved).add_cte(recorded, told, queued)
    )
    return ended or 0


def _of(value: Any, column: Any) -> ColumnElement[Any]:
    """A constant of the column's own type, cast in SQL. An `INSERT … SELECT` gives Postgres no
    column to read a parameter's type off, so every constant here says what it is."""
    return cast(literal(value, column.type), column.type)


def _text(value: str) -> ColumnElement[str]:
    return cast(literal(value), Text)


def _payload(payload: BaseModel, **per_row: Any) -> ColumnElement[dict[str, Any]]:
    """A stored payload as the model that reads it back dumps it, with the fields that vary down
    the set put back per row. `jsonb` holds no key order, so the two halves meet as one object,
    and a field the model gains is one this cannot quietly leave out."""
    fixed = payload.model_dump(mode="json", exclude=set(per_row))
    varying = func.jsonb_build_object(
        *chain.from_iterable((_text(name), value) for name, value in per_row.items())
    )
    return cast(literal(fixed, JSONB), JSONB).op("||", return_type=JSONB)(varying)
