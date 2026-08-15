from __future__ import annotations

import enum
from typing import TYPE_CHECKING, Final

from sync_core.models import ApplicationStatus

if TYPE_CHECKING:
    from collections.abc import Mapping


class ApplicationStage(enum.StrEnum):
    """What a Candidate is told about their own Application.

    Five values against the pipeline's eight, and deliberately: everything a Tenant does
    between arrival and a decision is one Stage, so shortlisting somebody and un-shortlisting
    them is invisible from the other side — which is what lets a Recruiter move an Application
    as freely as hiring really needs.
    """

    RECEIVED = "received"
    IN_REVIEW = "in_review"
    HIRED = "hired"
    NOT_SELECTED = "not_selected"
    WITHDRAWN = "withdrawn"


_PROJECTION: Final[Mapping[ApplicationStatus, ApplicationStage]] = {
    ApplicationStatus.NEW: ApplicationStage.RECEIVED,
    ApplicationStatus.REVIEWING: ApplicationStage.IN_REVIEW,
    ApplicationStatus.SHORTLISTED: ApplicationStage.IN_REVIEW,
    ApplicationStatus.INTERVIEW: ApplicationStage.IN_REVIEW,
    ApplicationStatus.OFFER: ApplicationStage.IN_REVIEW,
    ApplicationStatus.HIRED: ApplicationStage.HIRED,
    ApplicationStatus.REJECTED: ApplicationStage.NOT_SELECTED,
    ApplicationStatus.WITHDRAWN: ApplicationStage.WITHDRAWN,
}


def stage_of(status: ApplicationStatus) -> ApplicationStage:
    """The Stage a status reads as. Total over the enum, so a status added to the pipeline
    without an answer here fails at import rather than at the Candidate."""
    return _PROJECTION[status]


def is_decided(stage: ApplicationStage) -> bool:
    """Whether the Application has an outcome — which is what closes withdrawal."""
    return stage not in {ApplicationStage.RECEIVED, ApplicationStage.IN_REVIEW}


_UNPROJECTED = set(ApplicationStatus) - set(_PROJECTION)
if _UNPROJECTED:  # pragma: no cover — the module refuses to import instead
    raise RuntimeError(f"no Stage for {sorted(status.value for status in _UNPROJECTED)}")
