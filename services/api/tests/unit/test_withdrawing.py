from __future__ import annotations

from sync_api.applications.pipeline import _EXITS_FROM_REJECTED, may_withdraw, moves_open_to
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


def test_the_withdraw_button_reads_the_very_move_it_offers() -> None:
    """`can_withdraw` on the payload and the refusal in the pipeline are one lookup."""
    for stage in ApplicationStage:
        assert may_withdraw(stage) is (
            ApplicationStatus.WITHDRAWN
            in moves_open_to(StatusChangeSource.CANDIDATE, ApplicationStatus.REVIEWING, stage)
        )


def test_a_rejection_is_the_candidates_to_withdraw_from_and_the_take_back_covers_it() -> None:
    """The pair the import-time guard holds: the Candidate's own exit from `rejected`, and the
    take-back that fires on it as well as on the Tenant's reopen."""
    assert moves_open_to(
        StatusChangeSource.CANDIDATE, ApplicationStatus.REJECTED, ApplicationStage.IN_REVIEW
    ) == {ApplicationStatus.WITHDRAWN}
    assert not moves_open_to(
        StatusChangeSource.CANDIDATE, ApplicationStatus.REJECTED, ApplicationStage.NOT_SELECTED
    )
    assert set(_EXITS_FROM_REJECTED) == {
        ApplicationStatus.REVIEWING,
        ApplicationStatus.WITHDRAWN,
    }


def test_each_source_is_answered_by_what_that_source_reads() -> None:
    """Why a Candidate move added later carries none of withdrawing's rule: theirs is keyed by
    the Stage alone, and a Recruiter's by the status alone."""
    assert moves_open_to(
        StatusChangeSource.CANDIDATE, ApplicationStatus.REJECTED, ApplicationStage.IN_REVIEW
    ) == moves_open_to(
        StatusChangeSource.CANDIDATE, ApplicationStatus.SHORTLISTED, ApplicationStage.IN_REVIEW
    )
    assert moves_open_to(
        StatusChangeSource.RECRUITER, ApplicationStatus.REJECTED, ApplicationStage.IN_REVIEW
    ) == moves_open_to(
        StatusChangeSource.RECRUITER, ApplicationStatus.REJECTED, ApplicationStage.NOT_SELECTED
    )
    assert not moves_open_to(
        StatusChangeSource.SYSTEM, ApplicationStatus.REVIEWING, ApplicationStage.IN_REVIEW
    )
