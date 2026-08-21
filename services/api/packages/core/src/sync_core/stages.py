from __future__ import annotations

import enum
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final

from sync_core.models import ApplicationStatus
from sync_core.telling import told

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


def stage_of(
    status: ApplicationStatus,
    *,
    told_at: datetime | None = None,
    now: datetime | None = None,
) -> ApplicationStage:
    """The Stage a status reads as at a moment. Total over the enum, so a status added to the
    pipeline without an answer here fails at import rather than at the Candidate.

    It answers to time as well: a rejection reads as In review until its Telling. The Telling
    is honoured only while the status is `rejected` — `told_at` survives a reopen, so a
    `reviewing` row carrying one is the record of a Candidate who was told rather than a
    promise that they are about to be.
    """
    if status is ApplicationStatus.REJECTED and not told(told_at, now or datetime.now(UTC)):
        return ApplicationStage.IN_REVIEW
    return _PROJECTION[status]


_UNPROJECTED = set(ApplicationStatus) - set(_PROJECTION)
if _UNPROJECTED:  # pragma: no cover — the module refuses to import instead
    raise RuntimeError(f"no Stage for {sorted(status.value for status in _UNPROJECTED)}")
