from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from sync_api.problems import APPLICATION_TRANSITION_PROBLEM_TYPE, Problem
from sync_core.models import ApplicationStatus, ApplicationStatusHistory, StatusChangeSource
from sync_core.notifications import ApplicationStageChanged, notify
from sync_core.stages import stage_of

if TYPE_CHECKING:
    from collections.abc import Mapping
    from datetime import datetime
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
    changed_at: datetime


async def move_application(
    session: AsyncSession,
    applied: Applied,
    *,
    to: ApplicationStatus,
    source: StatusChangeSource,
    by: UUID,
) -> Moved:
    """Move the Application, append the history, and tell the Candidate if the Stage changed.

    Every move is recorded; only a move that changes what the Candidate is told produces a
    Notification. Shortlisting somebody and un-shortlisting them is two entries in the history
    and silence at the other end.

    No transaction of its own: the caller's is what keeps the three from ever disagreeing, and
    what takes the notification back with a move that turns out not to have happened.
    """
    application = applied.application
    _refuse_impossible_move(application.status, to, source)

    previous, application.status = application.status, to
    previous_stage, stage = stage_of(previous), stage_of(to)
    history = ApplicationStatusHistory(
        application_id=application.id,
        change_source=source,
        changed_by_profile_id=by,
        previous_status=previous,
        new_status=to,
    )
    session.add(history)
    await session.flush()
    if stage is not previous_stage:
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
        )
    return Moved(
        status_history_id=history.id,
        status=to,
        previous_status=previous,
        stage=stage,
        previous_stage=previous_stage,
        candidate_notified=stage is not previous_stage,
        changed_at=history.created_at,
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
