from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.applications.access import own_application
from sync_api.applications.payload import MatchAssessment
from sync_api.problems import (
    ASSESSMENT_FAILED_PROBLEM_TYPE,
    ASSESSMENT_UNAVAILABLE_PROBLEM_TYPE,
    Problem,
)
from sync_assessments import PROMPT_VERSION, AssessmentError, match_request, record_the_reading
from sync_core import get_logger, transaction
from sync_core.models import ApplicationAiMatchAssessment

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter
    from sync_assessments import AssessedMatch, MatchAssessor, MatchRequest

logger = get_logger(__name__)


class MatchAssessmentService:
    """The Recruiter's second opinion on an Application: advisory, and never a verdict.

    The first opinion arrives on its own — the worker reads every Application as it lands. This
    is the Recruiter who doubts that reading and wants a better one, so it runs while they wait
    and answers with what it just read. Both build their document the same way, which is what
    makes the new reading comparable with the one it replaces rather than merely later than it.

    An Application carries one reading and cannot be left carrying none: asking again overwrites
    it, and there is no way to ask for it to be removed. A Recruiter who distrusts a number gets
    a new number, never an empty column — which is what keeps a Job's list sortable all the way
    down. No assessment, however many times it is asked for, is a word in the Screening verdict.
    """

    def __init__(self, session: AsyncSession, assessor: MatchAssessor | None) -> None:
        self._db = session
        self._assessor = assessor

    async def assess(self, recruiter: ActingRecruiter, application_id: UUID) -> MatchAssessment:
        tenant_id = recruiter.tenant.id
        await own_application(self._db, tenant_id, application_id)
        assessor = self._configured()
        request: MatchRequest = await match_request(self._db, application_id)

        # A model answers in its own time and nothing has been written yet, so the read's
        # transaction is let go of rather than held — with it, its Postgres connection —
        # across the call. Every row read above has been copied into `request` by now.
        await self._db.rollback()
        assessed = await _answered(assessor, request)

        async with transaction(self._db):
            written = (
                await self._db.scalars(
                    record_the_reading(application_id, assessed, model_name=assessor.model)
                )
            ).one()

        logger.info(
            "applications.assessed",
            application_id=str(application_id),
            tenant_id=str(tenant_id),
            model_name=assessor.model,
            prompt_version=PROMPT_VERSION,
            match_percentage=float(written.match_percentage),
        )
        return _view(written)

    async def current(
        self, recruiter: ActingRecruiter, application_id: UUID
    ) -> MatchAssessment | None:
        """The Application's reading, or nothing where no model has managed one yet."""
        await own_application(self._db, recruiter.tenant.id, application_id)
        row = await self._db.scalar(
            select(ApplicationAiMatchAssessment).where(
                ApplicationAiMatchAssessment.application_id == application_id
            )
        )
        return None if row is None else _view(row)

    def _configured(self) -> MatchAssessor:
        """Reading what was assessed never depends on a model; asking for another one does."""
        if self._assessor is None:
            raise Problem(
                status=503,
                type=ASSESSMENT_UNAVAILABLE_PROBLEM_TYPE,
                detail="AI match assessment is not configured on this deployment.",
            )
        return self._assessor


async def _answered(assessor: MatchAssessor, request: MatchRequest) -> AssessedMatch:
    try:
        return await assessor.assess(request)
    except AssessmentError as failed:
        raise Problem(
            status=502,
            type=ASSESSMENT_FAILED_PROBLEM_TYPE,
            detail="The model could not assess this application. The reading it had is "
            "untouched, so asking again is safe.",
        ) from failed


def _view(row: ApplicationAiMatchAssessment) -> MatchAssessment:
    details = row.assessment_details or {}
    return MatchAssessment(
        id=row.id,
        match_percentage=float(row.match_percentage),
        explanation=row.explanation,
        strengths=_phrases(details.get("strengths")),
        gaps=_phrases(details.get("gaps")),
        model_name=row.model_name,
        prompt_version=row.prompt_version,
        assessed_at=row.updated_at,
        first_assessed_at=row.created_at,
    )


def _phrases(written: object) -> list[str]:
    """`assessment_details` is jsonb, and a row an older prompt version wrote is still read
    by this one — whatever shape it left behind."""
    return [str(entry) for entry in written] if isinstance(written, list) else []
