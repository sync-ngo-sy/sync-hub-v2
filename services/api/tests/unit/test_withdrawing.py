from __future__ import annotations

from sync_api.applications.pipeline import _EXITS_FROM_REJECTED, MOVES, may_withdraw
from sync_core.models import ApplicationStatus, StatusChangeSource
from sync_core.stages import ApplicationStage


def test_only_a_stage_that_still_reads_as_ongoing_is_the_candidates_to_withdraw_from() -> None:
    """An outcome the Candidate has read has nothing left to leave, and the button is gone.
    A rejection before its Telling is not one of them: it reads In review, and reading the
    Stage rather than the status is what keeps the button and the move in step."""
    assert {stage for stage in ApplicationStage if may_withdraw(stage)} == {
        ApplicationStage.RECEIVED,
        ApplicationStage.IN_REVIEW,
    }


def test_a_rejection_is_the_candidates_to_withdraw_from_and_the_take_back_covers_it() -> None:
    """The pair the import-time guard holds: the Candidate's own exit from `rejected`, and the
    take-back that fires on it as well as on the Tenant's reopen."""
    assert MOVES[StatusChangeSource.CANDIDATE][ApplicationStatus.REJECTED] == {
        ApplicationStatus.WITHDRAWN
    }
    assert set(_EXITS_FROM_REJECTED) == {
        ApplicationStatus.REVIEWING,
        ApplicationStatus.WITHDRAWN,
    }
