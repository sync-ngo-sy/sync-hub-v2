from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final

from sqlalchemy import delete, func, select, update

from sync_api.problems import APPLICATION_TRANSITION_PROBLEM_TYPE, Problem
from sync_core.communications import (
    ApplicationRejection,
    candidate_contact,
    enqueue_email,
    rejection_key,
)
from sync_core.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusHistory,
    Communication,
    CommunicationStatus,
    CommunicationType,
    Notification,
    StatusChangeSource,
)
from sync_core.notifications import ApplicationStageChanged, notify
from sync_core.stages import ApplicationStage, stage_of
from sync_core.telling import the_telling_after

if TYPE_CHECKING:
    from collections.abc import Mapping
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.applications.access import Applied

#: The states an Application is still being decided in, and which a Recruiter moves freely
#: among — a pipeline that only ever went forwards would not match how hiring actually goes.
_UNDECIDED: Final[frozenset[ApplicationStatus]] = frozenset(
    {
        ApplicationStatus.NEW,
        ApplicationStatus.REVIEWING,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    }
)

_RECRUITER_DECIDES: Final[frozenset[ApplicationStatus]] = _UNDECIDED | {
    ApplicationStatus.HIRED,
    ApplicationStatus.REJECTED,
}

#: Where a Recruiter may take an Application from each state. Anything unspelled is refused,
#: so `hired` ends it, `rejected` ends it until a human takes it back to `reviewing`, and
#: `withdrawn` — the Candidate's own move — ends it for everybody.
_RECRUITER_MOVES: Final[Mapping[ApplicationStatus, frozenset[ApplicationStatus]]] = {
    **{state: _RECRUITER_DECIDES - {state} for state in _UNDECIDED},
    ApplicationStatus.REJECTED: frozenset({ApplicationStatus.REVIEWING}),
}

#: Where a Candidate may take their own Application, keyed by the Stage they read rather than
#: the status under it, because the Stage is the whole of what they can see: a rejection before
#: its Telling is theirs to leave, and a move added here names its own Stages.
_CANDIDATE_MOVES: Final[Mapping[ApplicationStage, frozenset[ApplicationStatus]]] = {
    ApplicationStage.RECEIVED: frozenset({ApplicationStatus.WITHDRAWN}),
    ApplicationStage.IN_REVIEW: frozenset({ApplicationStatus.WITHDRAWN}),
}


def moves_open_to(
    source: StatusChangeSource, status: ApplicationStatus, stage: ApplicationStage
) -> frozenset[ApplicationStatus]:
    """A Recruiter moves the pipeline they read; a Candidate moves the Stage they read."""
    if source is StatusChangeSource.RECRUITER:
        return _RECRUITER_MOVES.get(status, frozenset())
    if source is StatusChangeSource.CANDIDATE:
        return _CANDIDATE_MOVES.get(stage, frozenset())
    return frozenset()


def may_withdraw(stage: ApplicationStage) -> bool:
    """Whether an Application reading this Stage is still the Candidate's to leave."""
    return ApplicationStatus.WITHDRAWN in _CANDIDATE_MOVES.get(stage, frozenset())


#: The one move the Candidate never hears about. Before the Telling there is nothing to tell:
#: the Stage never changed. After it, the Stage does read In review again, silently — a Tenant
#: reversing its own decision is not news to deliver, and telling somebody they are back in
#: review after they have read a rejection offers hope the Tenant has not committed to.
_REOPENING: Final = (ApplicationStatus.REJECTED, ApplicationStatus.REVIEWING)

#: The two ways out of `rejected`: the Tenant takes its decision back, or the Candidate walks
#: away from an Application still reading In review. Both take the queued rejection back with
#: them — a withdrawal inside the three days is a decision taken without knowing about the
#: Tenant's, and sending the rejection afterwards would be the discourtesy the Telling exists
#: to prevent.
_EXITS_FROM_REJECTED: Final[frozenset[ApplicationStatus]] = frozenset(
    {ApplicationStatus.REVIEWING, ApplicationStatus.WITHDRAWN}
)

#: Both readings a `rejected` row has, off the projection rather than named here: In review
#: while its Telling is ahead, Not selected after it.
_REJECTED_READS_AS: Final[frozenset[ApplicationStage]] = frozenset(
    {
        stage_of(ApplicationStatus.REJECTED),
        stage_of(ApplicationStatus.REJECTED, told_at=the_telling_after(datetime.now(UTC))),
    }
)

# The take-back is complete rather than best-effort only while it covers every exit. An
# unnamed one would leave a Candidate an unseen Notification and an email nobody meant to
# send, so the module refuses to import instead — the same guard `sync_core.stages` keeps over
# its own projection.
_UNCOVERED_EXITS_FROM_REJECTED = {
    state
    for source in StatusChangeSource
    for stage in _REJECTED_READS_AS
    for state in moves_open_to(source, ApplicationStatus.REJECTED, stage)
} - _EXITS_FROM_REJECTED
if _UNCOVERED_EXITS_FROM_REJECTED:  # pragma: no cover
    raise RuntimeError(
        f"a rejection now also leaves for {sorted(_UNCOVERED_EXITS_FROM_REJECTED)}, "
        "which nothing takes the queued rejection back from"
    )


@dataclass(frozen=True, slots=True)
class Moved:
    """One move that happened, the history row recording it, whether it was worth telling the
    Candidate about, and — if it was a rejection — the day they hear."""

    status_history_id: UUID
    status: ApplicationStatus
    previous_status: ApplicationStatus
    stage: ApplicationStage
    previous_stage: ApplicationStage
    candidate_notified: bool
    told_at: datetime | None
    changed_at: datetime


async def move_application(
    session: AsyncSession,
    applied: Applied,
    *,
    to: ApplicationStatus,
    source: StatusChangeSource,
    by: UUID,
) -> Moved:
    """Move the Application, append the history, and hold all three channels to one Telling.

    Every move is recorded; only a move that changes what the Candidate is told produces a
    Notification. Shortlisting somebody and un-shortlisting them is two entries in the history
    and silence at the other end.

    A rejection is decided here and told three days later: `told_at` drives the Stage the
    Candidate reads, the Notification's `visible_at` and the email's `available_at` alike, so
    a decision taken back inside those three days is one they never saw — and taking it back
    wipes the Telling, drops the unseen Notification and cancels the waiting email. Either
    exit takes it back: the Tenant's own reopen, and the Candidate leaving an Application that
    still reads In review to them.

    No transaction of its own: the caller's is what keeps the four from ever disagreeing, and
    what takes them all back with a move that turns out not to have happened.
    """
    application = applied.application
    at = datetime.now(UTC)
    previous, previously_told_at = application.status, application.told_at
    # Where the Candidate stands now, against where this move leaves them once it has landed:
    # a rejection's Notification is written at the decision and read at the Telling, so the
    # Stage it names is the one waiting at the other end of those three days.
    previous_stage = stage_of(previous, told_at=previously_told_at, now=at)
    _refuse_impossible_move(previous, to, source, from_stage=previous_stage)

    application.status = to
    reopening = (previous, to) == _REOPENING
    exiting_rejected = previous is ApplicationStatus.REJECTED and to in _EXITS_FROM_REJECTED
    # A fresh three days rather than the date the last rejection left behind, which has long
    # since passed and would tell this one instantly.
    telling = the_telling_after(at) if to is ApplicationStatus.REJECTED else None
    if telling is not None:
        application.told_at = telling

    stage = stage_of(to)
    history = ApplicationStatusHistory(
        application_id=application.id,
        change_source=source,
        changed_by_profile_id=by,
        previous_status=previous,
        new_status=to,
    )
    session.add(history)
    await session.flush()
    notified = stage is not previous_stage and not reopening
    if notified:
        await notify(
            session,
            application.candidate_id,
            ApplicationStageChanged(
                application_id=application.id,
                job_title=applied.job.title,
                tenant_name=applied.tenant_name,
                stage=stage,
                previous_stage=previous_stage,
            ),
            visible_at=telling,
        )
    if telling is not None:
        await _queue_the_rejection(session, applied, by=by, decided_by=history.id, telling=telling)
    if exiting_rejected:
        await _take_the_rejection_back(session, application)
    return Moved(
        status_history_id=history.id,
        status=to,
        previous_status=previous,
        stage=stage,
        previous_stage=previous_stage,
        candidate_notified=notified and telling is None,
        told_at=application.told_at,
        changed_at=history.created_at,
    )


async def _queue_the_rejection(
    session: AsyncSession,
    applied: Applied,
    *,
    by: UUID,
    decided_by: UUID,
    telling: datetime,
) -> None:
    """The one rejection that emails: keyed by the move, so undoing and deciding it again is a
    second decision the Candidate hears about, not a swallowed duplicate. The sender may not
    take it before the Telling, which is the same moment the Stage and the bell answer to."""
    application = applied.application
    full_name, email = await candidate_contact(session, application.candidate_id)
    await enqueue_email(
        session,
        candidate_id=application.candidate_id,
        tenant_id=application.tenant_id,
        application_id=application.id,
        initiated_by_recruiter_id=by,
        recipient=email,
        idempotency_key=rejection_key(decided_by),
        available_at=telling,
        payload=ApplicationRejection(
            application_id=application.id,
            job_title=applied.job.title,
            tenant_name=applied.tenant_name,
            candidate_name=full_name,
        ),
    )


async def _take_the_rejection_back(session: AsyncSession, application: Application) -> None:
    """Undo what a rejection queued, as far as it can still be undone.

    The Telling is wiped off the row, the unseen Notification dropped and the waiting email
    cancelled. Each narrows itself to what is still ahead of the Telling, so this is the whole
    undo inside the three days and nothing at all after them: a Telling the Candidate reached
    is the record of what they read, a Notification they have read is not the platform's to
    drop, and an email that has gone cannot be un-sent.

    A withdrawal runs this having just written the Candidate a Notification of their own. That
    one survives because it carries no `visible_at` — it was told at once — and this drops only
    what is still held to a Telling.

    All three read the clock in Postgres rather than here, because two of them are racing the
    readers that do — the bell's own gate and the sender's claim — and a row this call thinks
    is still ahead of its Telling while they think it has passed is the one row that must not
    be left behind.
    """
    still_ahead = await session.scalar(
        select(Application.told_at > func.now()).where(Application.id == application.id)
    )
    if still_ahead:
        application.told_at = None
    await session.execute(
        delete(Notification).where(
            Notification.application_id == application.id, Notification.visible_at > func.now()
        )
    )
    await session.execute(
        update(Communication)
        .where(
            Communication.application_id == application.id,
            Communication.communication_type == CommunicationType.APPLICATION_REJECTION,
            Communication.status == CommunicationStatus.QUEUED,
            Communication.available_at > func.now(),
        )
        .values(status=CommunicationStatus.CANCELLED, completed_at=func.now())
    )


def _refuse_impossible_move(
    current: ApplicationStatus,
    wanted: ApplicationStatus,
    source: StatusChangeSource,
    *,
    from_stage: ApplicationStage,
) -> None:
    """One lookup, in whichever table the mover reads, so no move carries another's rule."""
    if wanted in moves_open_to(source, current, from_stage):
        return
    raise Problem(
        status=409,
        type=APPLICATION_TRANSITION_PROBLEM_TYPE,
        detail=_why_not(current, wanted, source),
    )


def _why_not(
    current: ApplicationStatus, wanted: ApplicationStatus, source: StatusChangeSource
) -> str:
    if wanted is current:
        return f"This application is already {current.value}."
    if wanted is ApplicationStatus.WITHDRAWN and source is not StatusChangeSource.CANDIDATE:
        return "Only the candidate who applied can withdraw an application."
    return f"A {current.value} application cannot become {wanted.value}."
