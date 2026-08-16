from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import delete, select

from sync_api.applications.access import own_application
from sync_api.applications.payload import MatchAssessment, MatchAssessmentPage
from sync_api.pagination import DEFAULT_PAGE_SIZE, Cursor, newest_first, page_of
from sync_api.problems import (
    ASSESSMENT_FAILED_PROBLEM_TYPE,
    ASSESSMENT_NOT_FOUND_PROBLEM_TYPE,
    ASSESSMENT_UNAVAILABLE_PROBLEM_TYPE,
    Problem,
)
from sync_assessments import PROMPT_VERSION, AssessmentError, assessment_row, match_request
from sync_core import get_logger, transaction
from sync_core.models import ApplicationAiMatchAssessment

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter
    from sync_assessments import AssessedMatch, MatchAssessor, MatchRequest

logger = get_logger(__name__)


class MatchAssessmentService:
    """The Recruiter's second opinion on an Application: on demand, advisory, never rewritten.

    The Candidate's side of what it reads is the immutable Snapshot, never the live profile:
    an assessment says how the Application was sent, not how its author reads today. The
    Job's side is the criteria Screening measured plus the Job's own words, which is what
    lets a model say anything Screening could not — and which it reads as they stand, since
    only the criteria are locked once Applications arrive.

    What it writes is one more row: asking again appends, so a reading keeps the model and
    the prompt version that wrote it for as long as it is kept. A reading can be thrown away
    one at a time, which takes that row and nothing else — every reading left behind still
    reads as its own model wrote it. No assessment, however many are run, is a word in the
    Screening verdict.
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

        row = assessment_row(application_id, assessed, model_name=assessor.model)
        async with transaction(self._db):
            self._db.add(row)
            await self._db.flush()

        logger.info(
            "applications.assessed",
            application_id=str(application_id),
            tenant_id=str(tenant_id),
            model_name=assessor.model,
            prompt_version=PROMPT_VERSION,
            match_percentage=float(row.match_percentage),
        )
        return _view(row)

    async def page(
        self,
        recruiter: ActingRecruiter,
        application_id: UUID,
        *,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> MatchAssessmentPage:
        await own_application(self._db, recruiter.tenant.id, application_id)
        found = list(
            await self._db.scalars(
                newest_first(
                    select(ApplicationAiMatchAssessment).where(
                        ApplicationAiMatchAssessment.application_id == application_id
                    ),
                    created_at=ApplicationAiMatchAssessment.created_at,
                    id_=ApplicationAiMatchAssessment.id,
                    cursor=cursor,
                    limit=limit,
                )
            )
        )
        rows, next_cursor = page_of(found, limit=limit, cursor_for=_cursor)
        return MatchAssessmentPage(items=[_view(row) for row in rows], next_cursor=next_cursor)

    async def remove(
        self, recruiter: ActingRecruiter, application_id: UUID, assessment_id: UUID
    ) -> None:
        """The row has no tenant of its own, so the Application it hangs off is what scopes it."""
        await own_application(self._db, recruiter.tenant.id, application_id)
        async with transaction(self._db):
            deleted = await self._db.scalars(
                delete(ApplicationAiMatchAssessment)
                .where(
                    ApplicationAiMatchAssessment.id == assessment_id,
                    ApplicationAiMatchAssessment.application_id == application_id,
                )
                .returning(ApplicationAiMatchAssessment.id)
            )
            if deleted.one_or_none() is None:
                raise _no_such_assessment()

        logger.info(
            "applications.assessment_deleted",
            assessment_id=str(assessment_id),
            application_id=str(application_id),
            tenant_id=str(recruiter.tenant.id),
        )

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
            detail="The model could not assess this application. Nothing was recorded, so "
            "asking again is safe.",
        ) from failed


def _no_such_assessment() -> Problem:
    return Problem(
        status=404,
        type=ASSESSMENT_NOT_FOUND_PROBLEM_TYPE,
        detail="No assessment of this application has that id.",
    )


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
        assessed_at=row.created_at,
    )


def _phrases(written: object) -> list[str]:
    """`assessment_details` is jsonb, and a row an older prompt version wrote is still read
    by this one — whatever shape it left behind."""
    return [str(entry) for entry in written] if isinstance(written, list) else []


def _cursor(row: ApplicationAiMatchAssessment) -> Cursor:
    return Cursor(created_at=row.created_at, id=row.id)
