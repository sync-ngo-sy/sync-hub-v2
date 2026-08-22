from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import chain
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import Text, case, cast, delete, func, insert, literal, null, select, update
from sqlalchemy.dialects.postgresql import JSONB

from sync_api.applications.pipeline import (
    SWEEPABLE_DESTINATIONS,
    moves_open_to,
    still_undecided,
)
from sync_core.communications import REJECTION_KEY_PREFIX, ApplicationRejection
from sync_core.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Communication,
    CommunicationChannel,
    CommunicationStatus,
    CommunicationType,
    Job,
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

    from sync_core.models import QualificationStatus

#: The Application every payload below names is the row's own, filled in by the statement rather
#: than by the model. Each model is built around this one and its dump leaves it out, so it
#: reaches no row — what it buys is that every other field of the payload is still model-checked.
_FILLED_IN_PER_ROW: Final = UUID(int=0)

# A set-based move is the pipeline's own move taken over a set, so it may only go where a Recruiter
# could take one Application at a time. A pipeline that stopped allowing one of these pairs would
# leave this writing histories the state machine refuses, so the module refuses to import instead —
# the same guard `sync_api.applications.pipeline` keeps over the one exit from `rejected`.
_UNSWEEPABLE = {
    (source.value, wanted.value)
    for source in ApplicationStatus
    if still_undecided(source)
    for wanted in SWEEPABLE_DESTINATIONS - {source}
    if wanted not in moves_open_to(StatusChangeSource.RECRUITER, source, stage_of(source))
}
if _UNSWEEPABLE:  # pragma: no cover — the module refuses to import instead
    raise RuntimeError(
        f"a recruiter can no longer make these moves one at a time: {sorted(_UNSWEEPABLE)}"
    )


_REOPENING: Final = (ApplicationStatus.REJECTED, ApplicationStatus.REVIEWING)

if _REOPENING[1] not in moves_open_to(  # pragma: no cover
    StatusChangeSource.RECRUITER, _REOPENING[0], stage_of(_REOPENING[0])
):
    raise RuntimeError(
        "a recruiter can no longer take a rejected Application back to reviewing one at a time, "
        "so a set of them must not either"
    )


@dataclass(frozen=True, slots=True)
class SweepScope:
    """Which Applications one set-based move can reach: one Job the Tenant is hiring for, every
    one of them narrowed by the Received window, or exactly the ids a Recruiter ticked.

    The tenant scopes the reach either way, so an id belonging to somebody else reaches nothing
    rather than refusing.
    """

    tenant_id: UUID
    job_id: UUID | None = None
    received_after: datetime | None = None
    application_ids: tuple[UUID, ...] | None = None


@dataclass(frozen=True, slots=True)
class Swept:
    """What one set-based move did: how many Applications it moved, and the Telling they all now
    carry where it ended them.

    No Telling where it moved nothing, and none at all where it moved them along the ladder —
    that move reaches nobody, so nobody is waiting to be told about it.
    """

    count: int
    told_at: datetime | None


async def sweep_them_all(
    session: AsyncSession,
    scope: SweepScope,
    *,
    statuses: Collection[ApplicationStatus],
    to: ApplicationStatus,
    qualification_statuses: Collection[QualificationStatus] | None = None,
    by: UUID,
) -> Swept:
    """Move every Application the scope reaches standing in one of `statuses` to `to`, set-based.

    One statement per status swept, whatever those statuses hold: twelve Applications and fifty
    thousand cost the same, because nothing here reads a row into Python. Each statement moves its
    rows and appends their histories together, and adds whichever of the Candidate's channels the
    move really owes them.

    Where `to` is `rejected` that is the same rejection a single move makes, held to the same
    Telling: one `told_at` for the whole set, on every Notification and queued email alike. Undoing
    it is reading the rejections back and moving them, which the single-move path already answers.

    Where `to` is a rung of the ladder it is silent, because the four rungs above `new` are one
    Stage to the Candidate. Only a row leaving `new` crosses a Stage boundary, and that one gets
    the Notification saying so and nothing else — no Telling, and no email.

    A row moving out of `rejected` is silent too, and takes the rejection back with it: Tellings
    still ahead are wiped, unseen Notifications dropped, queued emails cancelled. Each reads the
    clock in Postgres, so a Telling that passed mid-statement keeps what the Candidate read.

    No transaction of its own: the caller's is what keeps a half-swept list from being a state
    anybody can land in.
    """
    if to not in SWEEPABLE_DESTINATIONS:
        raise ValueError(f"a sweep cannot move Applications to {to.value}")

    ending = to is ApplicationStatus.REJECTED
    telling = the_telling_after(datetime.now(UTC)) if ending else None
    tenant_name = await session.scalar(select(Tenant.name).where(Tenant.id == scope.tenant_id))
    swept = 0
    for previous in sorted(statuses, key=lambda status: status.value):
        if previous is to:
            continue
        swept += await _move_those_in(
            session,
            previous,
            to=to,
            scope=scope,
            tenant_name=tenant_name or "",
            qualification_statuses=qualification_statuses,
            by=by,
            telling=telling,
        )
    return Swept(count=swept, told_at=telling if swept else None)


async def _move_those_in(
    session: AsyncSession,
    previous: ApplicationStatus,
    *,
    to: ApplicationStatus,
    scope: SweepScope,
    tenant_name: str,
    qualification_statuses: Collection[QualificationStatus] | None,
    by: UUID,
    telling: datetime | None,
) -> int:
    """One statement, for one status the Reading named: the moves, their histories, and whichever of
    the bell and the email this particular move owes.

    The `UPDATE` is what decides which Applications took part, and everything else reads its
    `RETURNING` rather than a `SELECT` of its own. So an Application somebody hired between this
    statement's snapshot and its own row lock is left alone whole, rather than moved with a
    history, a Notification and an email standing behind it.

    The Job's title is read per row off a join rather than passed in, because a Tenant-wide sweep
    spans as many titles as it does Jobs.
    """
    reaching = [
        Application.tenant_id == scope.tenant_id,
        Application.status == previous,
    ]
    if scope.job_id is not None:
        reaching.append(Application.job_id == scope.job_id)
    if scope.received_after is not None:
        reaching.append(Application.applied_at > scope.received_after)
    if qualification_statuses is not None:
        reaching.append(Application.qualification_status.in_(qualification_statuses))
    if scope.application_ids is not None:
        reaching.append(Application.id.in_(scope.application_ids))

    reopening = (previous, to) == _REOPENING
    moving: dict[str, Any] = {"status": to}
    if telling is not None:
        moving["told_at"] = telling
    if reopening:
        moving["told_at"] = case(
            (Application.told_at > func.now(), null()), else_=Application.told_at
        )

    moved = (
        update(Application)
        .where(*reaching)
        .values(**moving)
        .returning(
            Application.id.label("id"),
            Application.candidate_id.label("candidate_id"),
            Application.job_id.label("job_id"),
        )
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
                _constant(
                    StatusChangeSource.RECRUITER, like=ApplicationStatusHistory.change_source
                ),
                _constant(by, like=ApplicationStatusHistory.changed_by_profile_id),
                _constant(previous, like=ApplicationStatusHistory.previous_status),
                _constant(to, like=ApplicationStatusHistory.new_status),
            ),
        )
        .returning(
            ApplicationStatusHistory.id.label("id"),
            ApplicationStatusHistory.application_id.label("application_id"),
        )
        .cte("recorded")
    )
    also = []

    stage, previous_stage = stage_of(to), stage_of(previous)
    if stage is not previous_stage and not reopening:
        also.append(
            insert(Notification)
            .from_select(
                ["recipient_profile_id", "type", "payload", "application_id", "visible_at"],
                select(
                    moved.c.candidate_id,
                    _constant(NotificationType.APPLICATION_STAGE_CHANGED, like=Notification.type),
                    _payload(
                        ApplicationStageChanged(
                            application_id=_FILLED_IN_PER_ROW,
                            job_title="",
                            tenant_name=tenant_name,
                            stage=stage,
                            previous_stage=previous_stage,
                        ),
                        application_id=moved.c.id,
                        job_title=Job.title,
                    ),
                    moved.c.id,
                    _when(telling, like=Notification.visible_at),
                )
                .select_from(moved)
                .join(Job, Job.id == moved.c.job_id),
            )
            .returning(Notification.id)
            .cte("told")
        )

    if telling is not None:
        also.append(
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
                    _constant(scope.tenant_id, like=Communication.tenant_id),
                    recorded.c.application_id,
                    _constant(by, like=Communication.initiated_by_recruiter_id),
                    _constant(CommunicationChannel.EMAIL, like=Communication.channel),
                    _constant(
                        CommunicationType.APPLICATION_REJECTION,
                        like=Communication.communication_type,
                    ),
                    func.coalesce(User.email, _text("")),
                    _payload(
                        ApplicationRejection(
                            application_id=_FILLED_IN_PER_ROW,
                            job_title="",
                            tenant_name=tenant_name,
                            candidate_name="",
                        ),
                        application_id=recorded.c.application_id,
                        candidate_name=Profile.full_name,
                        job_title=Job.title,
                    ),
                    _text(ApplicationRejection.template_key),
                    _text(REJECTION_KEY_PREFIX).concat(cast(recorded.c.id, Text)),
                    _constant(telling, like=Communication.available_at),
                )
                .select_from(recorded)
                .join(moved, moved.c.id == recorded.c.application_id)
                .join(Job, Job.id == moved.c.job_id)
                .join(Profile, Profile.id == moved.c.candidate_id)
                .outerjoin(User, User.id == moved.c.candidate_id),
            )
            .returning(Communication.id)
            .cte("queued")
        )

    if reopening:
        also.append(
            delete(Notification)
            .where(
                Notification.application_id.in_(select(moved.c.id)),
                Notification.visible_at > func.now(),
            )
            .returning(Notification.id)
            .cte("dropped")
        )
        also.append(
            update(Communication)
            .where(
                Communication.application_id.in_(select(moved.c.id)),
                Communication.communication_type == CommunicationType.APPLICATION_REJECTION,
                Communication.status == CommunicationStatus.QUEUED,
                Communication.available_at > func.now(),
            )
            .values(status=CommunicationStatus.CANCELLED, completed_at=func.now())
            .returning(Communication.id)
            .cte("cancelled")
        )

    swept = await session.scalar(select(func.count()).select_from(moved).add_cte(recorded, *also))
    return swept or 0


def _when(moment: datetime | None, *, like: Any) -> ColumnElement[Any]:
    """A moment the whole set shares, or the SQL null a move that tells nobody at once carries."""
    if moment is None:
        return cast(null(), like.type)
    return _constant(moment, like=like)


def _constant(value: Any, *, like: Any) -> ColumnElement[Any]:
    """One value, the same down every row, typed as the column it is going into. An
    `INSERT … SELECT` gives Postgres no column to read a parameter's type off, so each of these
    says in SQL what it is."""
    return cast(literal(value, like.type), like.type)


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
