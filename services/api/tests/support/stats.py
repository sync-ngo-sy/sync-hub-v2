from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import update

from sync_core.models import Application, ApplicationStatus, Job, QualificationStatus

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

TENANT_STATS: Final = "/v1/tenants/me/stats"
TENANT_APPLICATIONS: Final = "/v1/tenants/me/applications"
TENANT_TRACKED_LINKS: Final = "/v1/tenants/me/tracked-links"


async def read_stats(browser: AsyncClient) -> Response:
    return await browser.get(TENANT_STATS)


async def stats_of(browser: AsyncClient) -> dict[str, Any]:
    response = await read_stats(browser)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def days_ago(days: float) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


async def received_days_ago(session: AsyncSession, application_id: UUID, days: float) -> None:
    """Move an Application back in time. The windows are rolling, so a test that wants one
    inside "last week" has to put it there — nothing else can."""
    await session.execute(
        update(Application)
        .where(Application.id == application_id)
        .values(applied_at=days_ago(days))
    )
    await session.commit()


async def published_days_ago(session: AsyncSession, job_id: str | UUID, days: float) -> None:
    await session.execute(
        update(Job).where(Job.id == UUID(str(job_id))).values(published_at=days_ago(days))
    )
    await session.commit()


async def decide(
    session: AsyncSession,
    application_id: UUID,
    *,
    status: ApplicationStatus | None = None,
    qualification_status: QualificationStatus | None = None,
) -> None:
    """Put an Application in a state directly. Moving one through the pipeline properly is the
    review endpoints' business, and these tests are about the counting."""
    changes: dict[str, Any] = {}
    if status is not None:
        changes["status"] = status
    if qualification_status is not None:
        changes["qualification_status"] = qualification_status
        # A refusal names what refused it — `applications_disqualification_has_a_reason`. Screening
        # writes the reason with the status, and so does this, rather than writing a verdict the
        # schema will not hold and no Recruiter could have read.
        if qualification_status is QualificationStatus.DISQUALIFIED:
            changes["qualification_reason"] = "the fixture said so"
    await session.execute(
        update(Application).where(Application.id == application_id).values(**changes)
    )
    await session.commit()


async def forget_when_it_went_live(session: AsyncSession, job_id: str | UUID) -> None:
    """A Job as it stands after a deploy that added `published_at` without backfilling it:
    live, and with nothing recording when it became so."""
    await session.execute(update(Job).where(Job.id == UUID(str(job_id))).values(published_at=None))
    await session.commit()
