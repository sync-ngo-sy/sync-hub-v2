from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final

from sqlalchemy import delete, update

from sync_api.problems import APPLICATION_TRANSITION_PROBLEM_TYPE, Problem
from sync_core.communications import ApplicationRejection, candidate_contact, enqueue_email
from sync_core.models import (
    ApplicationStatus,
    ApplicationStatusHistory,
    Communication,
    CommunicationStatus,
    CommunicationType,
    Notification,
    StatusChangeSource,
)
from sync_core.notifications import ApplicationStageChanged, notify
from sync_core.stages import stage_of
from sync_core.telling import the_telling_after

if TYPE_CHECKING:
    from collections.abc import Mapping
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.applications.access import Applied
    from sync_core.stages import ApplicationStage

#: The states an Application is still being decided in, and which a Recruiter moves freely
#: among — a pipeline that only ever went forwards would not match how hiring actually goes.
UNDECIDED: Final[frozenset[ApplicationStatus]] = frozenset(
    {
        ApplicationStatus.NEW,
        ApplicationStatus.REVIEWING,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    }
)

_RECRUITER_DECIDES: Final[frozenset[ApplicationStatus]] = UNDECIDED | {
    ApplicationStatus.HIRED,
    ApplicationStatus.REJECTED,
}

#: Where each source may take an Application from each state. Anything unspelled is refused,
#: so `hired` ends it, `rejected` ends it until a human takes it back to `reviewing`, and
#: `withdrawn` — the Candidate's own move — ends it for everybody.
MOVES: Final[
    Mapping[StatusChangeSource, Mapping[ApplicationStatus, frozenset[ApplicationStatus]]]
] = {
    StatusChangeSource.RECRUITER: {
        **{state: _RECRUITER_DECIDES - {state} for state in UNDECIDED},
        ApplicationStatus.REJECTED: frozenset({ApplicationStatus.REVIEWING}),
    },
    StatusChangeSource.CANDIDATE: {
        state: frozenset({ApplicationStatus.WITHDRAWN}) for state in UNDECIDED
    },
}

#: The one move the Candidate never hears about, and the only exit from `rejected`. Before the
#: Telling there is nothing to tell: the Stage never changed. After it, the Stage does read In
#: review again, silently — a Tenant reversing its own decision is not news to deliver, and
#: telling somebody they are back in review after they have read a rejection offers hope the
#: Tenant has not committed to.
_REOPENING: Final = (ApplicationStatus.REJECTED, ApplicationStatus.REVIEWING)


@dataclass(frozen=True, slots=True)
class Moved:
    """One move that happened, the history row recording it, and whether it was worth telling
    the Candidate about."""

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
    now: datetime | None = None,
) -> Moved:
    """Move the Application, append the history, and hold all three channels to one Telling.

    Every move is recorded; only a move that changes what the Candidate is told produces a
    Notification. Shortlisting somebody and un-shortlisting them is two entries in the history
    and silence at the other end.

    A rejection is decided here and told three days later: `told_at` drives the Stage the
    Candidate reads, the Notification's `visible_at` and the email's `available_at` alike, so
    a decision taken back inside those three days is one they never saw — and taking it back
    drops the unseen Notification and cancels the waiting email.

    No transaction of its own: the caller's is what keeps the four from ever disagreeing, and
    what takes them all back with a move that turns out not to have happened.
    """
    application = applied.application
    _refuse_impossible_move(application.status, to, source)

    at = now if now is not None else datetime.now(UTC)
    previous, previously_told_at = application.status, application.told_at
    application.status = to
    reopening = (previous, to) == _REOPENING
    # A fresh three days rather than the date the last rejection left behind, which has long
    # since passed and would tell this one instantly.
    telling = the_telling_after(at) if to is ApplicationStatus.REJECTED else None
    if telling is not None:
        application.told_at = telling

    # Where the Candidate stands now, against where this move leaves them once it has landed:
    # a rejection's Notification is written at the decision and read at the Telling, so the
    # Stage it names is the one waiting at the other end of those three days.
    previous_stage = stage_of(previous, told_at=previously_told_at, now=at)
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
    told = stage is not previous_stage and not reopening
    if told:
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
        await _queue_the_rejection(session, applied, by=by, decided_by=history.id, sent_at=telling)
    if reopening:
        await _take_the_rejection_back(session, application.id, now=at)
    return Moved(
        status_history_id=history.id,
        status=to,
        previous_status=previous,
        stage=stage,
        previous_stage=previous_stage,
        candidate_notified=told and telling is None,
        told_at=application.told_at,
        changed_at=history.created_at,
    )


async def _queue_the_rejection(
    session: AsyncSession,
    applied: Applied,
    *,
    by: UUID,
    decided_by: UUID,
    sent_at: datetime | None,
) -> None:
    """The one rejection that emails: keyed by the move, so undoing and deciding it again is a
    second decision the Candidate hears about, not a swallowed duplicate."""
    application = applied.application
    full_name, email = await candidate_contact(session, application.candidate_id)
    await enqueue_email(
        session,
        candidate_id=application.candidate_id,
        tenant_id=application.tenant_id,
        application_id=application.id,
        initiated_by_recruiter_id=by,
        recipient=email,
        idempotency_key=f"application-rejection:{decided_by}",
        available_at=sent_at,
        payload=ApplicationRejection(
            application_id=application.id,
            job_title=applied.job.title,
            tenant_name=applied.tenant_name,
            candidate_name=full_name,
        ),
    )


async def _take_the_rejection_back(
    session: AsyncSession, application_id: UUID, *, now: datetime
) -> None:
    """Undo what a rejection queued, as far as it can still be undone.

    The unseen Notification is dropped and the waiting email cancelled. Each narrows itself to
    what is still ahead of the Telling, so this is the whole undo inside the three days and
    nothing at all after them: a Notification the Candidate has read is not the platform's to
    drop, and an email that has gone cannot be un-sent.
    """
    await session.execute(
        delete(Notification).where(
            Notification.application_id == application_id, Notification.visible_at > now
        )
    )
    await session.execute(
        update(Communication)
        .where(
            Communication.application_id == application_id,
            Communication.communication_type == CommunicationType.APPLICATION_REJECTION,
            Communication.status == CommunicationStatus.QUEUED,
            Communication.available_at > now,
        )
        .values(status=CommunicationStatus.CANCELLED, completed_at=now)
    )


def _refuse_impossible_move(
    current: ApplicationStatus, wanted: ApplicationStatus, source: StatusChangeSource
) -> None:
    if wanted in MOVES.get(source, {}).get(current, frozenset()):
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
