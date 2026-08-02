from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import select

from sync_core.models import Application, Job, JobViewEvent
from tests.support.profiles import give_a_current_cv

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

TENANT_JOBS: Final = "/v1/tenants/me/jobs"
JOBS: Final = "/v1/jobs"

A_JOB: Final[dict[str, Any]] = {
    "title": "Senior Backend Engineer",
    "description": "Build and run the payment platform in Python and PostgreSQL.",
    "location_key": "sy-damascus",
    "employment_type": "full_time",
    "work_mode": "onsite",
}

NO_CRITERIA: Final[dict[str, Any]] = {
    "minimum_total_experience_years": None,
    "skills": [],
    "languages": [],
    "questions": [],
}


def a_job(**changes: Any) -> dict[str, Any]:
    return {**A_JOB, **changes}


def some_criteria(**changes: Any) -> dict[str, Any]:
    return {**NO_CRITERIA, **changes}


async def post_job(browser: AsyncClient, body: dict[str, Any] | None = None) -> Response:
    return await browser.post(TENANT_JOBS, json=a_job() if body is None else body)


async def a_created_job(browser: AsyncClient, **changes: Any) -> dict[str, Any]:
    response = await post_job(browser, a_job(**changes))
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


async def change_job(browser: AsyncClient, job_id: str, **changes: Any) -> Response:
    return await browser.patch(f"{TENANT_JOBS}/{job_id}", json=changes)


async def read_job(browser: AsyncClient, job_id: str) -> dict[str, Any]:
    response = await browser.get(f"{TENANT_JOBS}/{job_id}")
    assert response.status_code == 200, response.text
    job: dict[str, Any] = response.json()
    return job


async def set_criteria(browser: AsyncClient, job_id: str, **criteria: Any) -> Response:
    return await browser.put(f"{TENANT_JOBS}/{job_id}/criteria", json=some_criteria(**criteria))


async def a_published_job(browser: AsyncClient, **changes: Any) -> dict[str, Any]:
    job = await a_created_job(browser, **changes)
    published = await change_job(browser, job["id"], status="published")
    assert published.status_code == 200, published.text
    body: dict[str, Any] = published.json()
    return body


async def create_link(
    browser: AsyncClient, job_id: str, name: str = "LinkedIn campaign", **changes: Any
) -> Response:
    return await browser.post(f"{TENANT_JOBS}/{job_id}/links", json={"name": name, **changes})


async def a_tracked_link(browser: AsyncClient, job_id: str, **changes: Any) -> dict[str, Any]:
    response = await create_link(browser, job_id, **changes)
    assert response.status_code == 201, response.text
    link: dict[str, Any] = response.json()
    return link


async def change_link(browser: AsyncClient, job_id: str, link_id: str, **changes: Any) -> Response:
    return await browser.patch(f"{TENANT_JOBS}/{job_id}/links/{link_id}", json=changes)


async def links_of(browser: AsyncClient, job_id: str) -> list[dict[str, Any]]:
    response = await browser.get(f"{TENANT_JOBS}/{job_id}/links")
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()
    return found


async def browse(visitor: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await visitor.get(JOBS, params=params)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


async def read_public_job(visitor: AsyncClient, job_id: str) -> Response:
    return await visitor.get(f"{JOBS}/{job_id}")


async def follow_link(visitor: AsyncClient, token: str) -> Response:
    return await visitor.get(f"{JOBS}/by-link/{token}")


async def an_application(session: AsyncSession, job_id: str | UUID, candidate_id: UUID) -> UUID:
    """The row the criteria lock watches for, written directly: applying is #11's job."""
    job = await session.get(Job, UUID(str(job_id)))
    assert job is not None, f"no jobs row for {job_id}"
    application = Application(
        tenant_id=job.tenant_id,
        job_id=job.id,
        candidate_id=candidate_id,
        cv_id=await give_a_current_cv(session, candidate_id),
    )
    session.add(application)
    await session.commit()
    return application.id


async def job_views(session: AsyncSession, job_id: str | UUID) -> list[JobViewEvent]:
    session.expire_all()
    rows = await session.scalars(
        select(JobViewEvent)
        .where(JobViewEvent.job_id == UUID(str(job_id)))
        .order_by(JobViewEvent.id)
    )
    return list(rows)
