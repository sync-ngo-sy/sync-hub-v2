from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import select

from sync_core.models import ApplicationAiMatchAssessment
from tests.support.applications import TENANT_APPLICATIONS

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession


def assessments_url(application_id: str | UUID) -> str:
    return f"{TENANT_APPLICATIONS}/{application_id}/assessments"


async def assess(recruiter: AsyncClient, application_id: str | UUID) -> Response:
    return await recruiter.post(assessments_url(application_id))


async def an_assessment(recruiter: AsyncClient, application_id: str | UUID) -> dict[str, Any]:
    response = await assess(recruiter, application_id)
    assert response.status_code == 201, response.text
    assessment: dict[str, Any] = response.json()
    return assessment


async def list_assessments(
    recruiter: AsyncClient, application_id: str | UUID, **params: Any
) -> Response:
    return await recruiter.get(assessments_url(application_id), params=params)


async def assessments_of(
    recruiter: AsyncClient, application_id: str | UUID, **params: Any
) -> list[dict[str, Any]]:
    response = await list_assessments(recruiter, application_id, **params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


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
