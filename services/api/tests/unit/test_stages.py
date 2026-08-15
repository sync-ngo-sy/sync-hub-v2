from __future__ import annotations

from sync_core.models import ApplicationStatus
from sync_core.stages import ApplicationStage, is_decided, stage_of


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


def test_only_an_outcome_is_decided() -> None:
    assert not is_decided(ApplicationStage.RECEIVED)
    assert not is_decided(ApplicationStage.IN_REVIEW)
    assert is_decided(ApplicationStage.HIRED)
    assert is_decided(ApplicationStage.NOT_SELECTED)
    assert is_decided(ApplicationStage.WITHDRAWN)
