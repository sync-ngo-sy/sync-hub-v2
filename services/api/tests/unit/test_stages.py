from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sync_core.models import ApplicationStatus
from sync_core.stages import ApplicationStage, stage_of
from sync_core.telling import the_telling_after


def test_an_arrival_reads_as_received() -> None:
    assert stage_of(ApplicationStatus.NEW) is ApplicationStage.RECEIVED


def test_everything_between_arrival_and_a_decision_reads_as_one_stage() -> None:
    """The whole point: a Recruiter shortlisting and un-shortlisting somebody is invisible."""
    assert {
        stage_of(status)
        for status in (
            ApplicationStatus.REVIEWING,
            ApplicationStatus.SHORTLISTED,
            ApplicationStatus.INTERVIEW,
            ApplicationStatus.OFFER,
        )
    } == {ApplicationStage.IN_REVIEW}


def test_each_outcome_keeps_its_own_stage() -> None:
    assert stage_of(ApplicationStatus.HIRED) is ApplicationStage.HIRED
    assert stage_of(ApplicationStatus.REJECTED) is ApplicationStage.NOT_SELECTED
    assert stage_of(ApplicationStatus.WITHDRAWN) is ApplicationStage.WITHDRAWN


def test_every_status_the_pipeline_has_projects_to_a_stage() -> None:
    assert {stage_of(status) for status in ApplicationStatus} == set(ApplicationStage)


def test_a_rejection_reads_as_in_review_until_its_telling() -> None:
    """The time axis, asserted on its own: the totality check above guards every status
    against having no Stage, and says nothing about a Stage that answers to the clock too."""
    decided = datetime(2026, 8, 21, 9, 0, tzinfo=UTC)
    telling = the_telling_after(decided)

    assert stage_of(ApplicationStatus.REJECTED, told_at=telling, now=decided) is (
        ApplicationStage.IN_REVIEW
    )
    assert stage_of(
        ApplicationStatus.REJECTED, told_at=telling, now=telling - timedelta(seconds=1)
    ) is ApplicationStage.IN_REVIEW


def test_a_rejection_reads_as_not_selected_at_its_telling_and_after_it() -> None:
    telling = datetime(2026, 8, 24, 9, 0, tzinfo=UTC)

    assert stage_of(ApplicationStatus.REJECTED, told_at=telling, now=telling) is (
        ApplicationStage.NOT_SELECTED
    )
    assert stage_of(
        ApplicationStatus.REJECTED, told_at=telling, now=telling + timedelta(days=400)
    ) is ApplicationStage.NOT_SELECTED


def test_a_telling_is_honoured_only_while_the_status_is_rejected() -> None:
    """It survives a reopen, so a `reviewing` row carrying one is the record of a Candidate
    who was told — not a Candidate who is about to be."""
    still_waiting = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
    now = datetime(2026, 8, 21, 9, 0, tzinfo=UTC)

    assert stage_of(ApplicationStatus.REVIEWING, told_at=still_waiting, now=now) is (
        ApplicationStage.IN_REVIEW
    )
    assert stage_of(ApplicationStatus.HIRED, told_at=still_waiting, now=now) is (
        ApplicationStage.HIRED
    )
    assert stage_of(ApplicationStatus.WITHDRAWN, told_at=still_waiting, now=now) is (
        ApplicationStage.WITHDRAWN
    )


def test_a_rejection_with_no_telling_has_nothing_to_wait_for() -> None:
    assert stage_of(ApplicationStatus.REJECTED) is ApplicationStage.NOT_SELECTED
