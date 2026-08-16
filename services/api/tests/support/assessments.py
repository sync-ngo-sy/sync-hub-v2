from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import select

from sync_core.models import Application, ApplicationAiMatchAssessment, MatchAssessmentJob
from tests.support.applications import TENANT_APPLICATIONS

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession


def assessment_url(application_id: str | UUID) -> str:
    return f"{TENANT_APPLICATIONS}/{application_id}/assessment"


async def assess(recruiter: AsyncClient, application_id: str | UUID) -> Response:
    return await recruiter.post(assessment_url(application_id))


async def an_assessment(recruiter: AsyncClient, application_id: str | UUID) -> dict[str, Any]:
    response = await assess(recruiter, application_id)
    assert response.status_code == 200, response.text
    assessment: dict[str, Any] = response.json()
    return assessment


async def read_assessment(recruiter: AsyncClient, application_id: str | UUID) -> Response:
    return await recruiter.get(assessment_url(application_id))


async def the_assessment_of(
    recruiter: AsyncClient, application_id: str | UUID
) -> dict[str, Any] | None:
    response = await read_assessment(recruiter, application_id)
    assert response.status_code == 200, response.text
    read: dict[str, Any] | None = response.json()
    return read


async def stored_assessments(
    session: AsyncSession, application_id: str | UUID
) -> list[ApplicationAiMatchAssessment]:
    session.expire_all()
    rows = await session.scalars(
        select(ApplicationAiMatchAssessment)
        .where(ApplicationAiMatchAssessment.application_id == UUID(str(application_id)))
        .order_by(ApplicationAiMatchAssessment.created_at)
    )
    return list(rows)


async def assessment_job(session: AsyncSession, application_id: str | UUID) -> MatchAssessmentJob:
    """The queue row the Application's arrival opened."""
    session.expire_all()
    job = await session.scalar(
        select(MatchAssessmentJob).where(
            MatchAssessmentJob.application_id == UUID(str(application_id))
        )
    )
    assert job is not None, "the arrival trigger opened no assessment job"
    return job


async def match_score_of(session: AsyncSession, application_id: str | UUID) -> float | None:
    """The number a Job's list sorts this Application by."""
    session.expire_all()
    score = await session.scalar(
        select(Application.current_match_score).where(Application.id == UUID(str(application_id)))
    )
    return None if score is None else float(score)
