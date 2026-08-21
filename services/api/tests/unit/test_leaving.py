from __future__ import annotations

from sync_api.applications.pipeline import (
    _EXITS_FROM_REJECTED,
    MOVES,
    may_withdraw,
)
from sync_core.models import ApplicationStatus
from sync_core.stages import ApplicationStage


def test_an_application_that_still_reads_as_ongoing_is_the_candidates_to_leave() -> None:
    assert may_withdraw(ApplicationStage.RECEIVED)
    assert may_withdraw(ApplicationStage.IN_REVIEW)


def test_an_outcome_the_candidate_has_read_is_not_theirs_to_leave() -> None:
    """There is nothing left to leave, and the button is correctly gone."""
    assert not may_withdraw(ApplicationStage.HIRED)
    assert not may_withdraw(ApplicationStage.NOT_SELECTED)
    assert not may_withdraw(ApplicationStage.WITHDRAWN)


def test_every_stage_has_an_answer() -> None:
    assert {stage for stage in ApplicationStage if may_withdraw(stage)} == {
        ApplicationStage.RECEIVED,
        ApplicationStage.IN_REVIEW,
    }


def test_the_take_back_names_every_exit_a_rejection_has() -> None:
    """The guard the module holds at import, asserted where a reader can see it: a rejection
    leaves for exactly the two states the take-back fires on, and a third would leave the
    Candidate an unseen Notification and an email nobody meant to send."""
    assert (
        {
            state
            for by_status in MOVES.values()
            for state in by_status.get(ApplicationStatus.REJECTED, frozenset())
        }
        == _EXITS_FROM_REJECTED
        == {ApplicationStatus.REVIEWING, ApplicationStatus.WITHDRAWN}
    )
