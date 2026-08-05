from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, update

from sync_core.models import (
    Candidate,
    CandidateEducation,
    CandidateEmbeddingJob,
    CandidateExperience,
    CandidateLanguage,
    CandidateProfileChunk,
    CandidateProject,
    CandidateSkill,
    Cv,
    CvParsingStatus,
)
from tests.support.extractors import a_parse

if TYPE_CHECKING:
    from httpx import AsyncClient, Response
    from sqlalchemy.ext.asyncio import AsyncSession

SECTIONS: dict[str, Any] = {
    "experiences": CandidateExperience,
    "educations": CandidateEducation,
    "skills": CandidateSkill,
    "languages": CandidateLanguage,
    "projects": CandidateProject,
}


async def my_id(browser: AsyncClient) -> UUID:
    response = await browser.get("/v1/auth/me")
    assert response.status_code == 200, response.text
    return UUID(response.json()["id"])


async def section_row_counts(session: AsyncSession, candidate_id: UUID) -> dict[str, int]:
    counts = {}
    for section, entity in SECTIONS.items():
        rows = await session.scalar(
            select(func.count()).select_from(entity).where(entity.candidate_id == candidate_id)
        )
        counts[section] = int(rows or 0)
    return counts


@dataclass(frozen=True, slots=True)
class EmbeddingJob:
    dirty: bool
    revision: int
    claimed_at: datetime | None
    attempts: int
    error_message: str | None
    updated_at: datetime


async def embedding_jobs(session: AsyncSession, candidate_id: UUID) -> list[EmbeddingJob]:
    session.expire_all()
    rows = await session.scalars(
        select(CandidateEmbeddingJob).where(CandidateEmbeddingJob.candidate_id == candidate_id)
    )
    return [
        EmbeddingJob(
            dirty=row.dirty,
            revision=row.revision,
            claimed_at=row.claimed_at,
            attempts=row.attempts,
            error_message=row.error_message,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


async def profile_chunks(session: AsyncSession, candidate_id: UUID) -> list[CandidateProfileChunk]:
    session.expire_all()
    rows = await session.scalars(
        select(CandidateProfileChunk)
        .where(CandidateProfileChunk.candidate_id == candidate_id)
        .order_by(CandidateProfileChunk.chunk_index)
    )
    return list(rows)


async def give_a_current_cv(
    session: AsyncSession,
    candidate_id: UUID,
    *,
    parsing_status: CvParsingStatus = CvParsingStatus.READY,
) -> UUID:
    cv_id = uuid4()
    cv = Cv(
        id=cv_id,
        candidate_id=candidate_id,
        display_name="cv.pdf",
        storage_path=f"{candidate_id}/{cv_id}.pdf",
        file_hash=f"hash-{cv_id}",  # unique: one candidate may be given several CVs
        parsing_status=parsing_status,
        **_settled(parsing_status),
    )
    session.add(cv)
    await session.flush()
    await session.execute(
        update(Candidate).where(Candidate.id == candidate_id).values(current_cv_id=cv.id)
    )
    await session.commit()
    return cv.id


def _settled(parsing_status: CvParsingStatus) -> dict[str, Any]:
    if parsing_status is CvParsingStatus.READY:
        return {"parsed_cv_data": a_parse().model_dump(mode="json"), "parsed_at": datetime.now(UTC)}
    if parsing_status is CvParsingStatus.FAILED:
        return {"parsing_error": "the fixture said so"}
    return {}


async def make_no_cv_current(session: AsyncSession, candidate_id: UUID) -> None:
    """A candidate back to holding no CV — the one state applying still refuses."""
    await session.execute(
        update(Candidate).where(Candidate.id == candidate_id).values(current_cv_id=None)
    )
    await session.commit()


def a_profile(**changes: Any) -> dict[str, Any]:
    """A valid `PUT` body carrying nothing but the identity every profile has to have."""
    return {**EMPTY_PROFILE, **changes}


EMPTY_PROFILE: dict[str, Any] = {
    "full_name": "Amina Haddad",
    "phone": None,
    "headline": None,
    "summary": None,
    "location_key": None,
    "canonical_role_key": None,
    "preferred_language_code": None,
    "is_searchable": False,
    "total_experience_years": 0,
    "experiences": [],
    "educations": [],
    "skills": [],
    "languages": [],
    "projects": [],
    "unmapped_skills": [],
}

AN_EXPERIENCE: dict[str, Any] = {
    "job_title": "Senior Engineer",
    "company_name": "Acme",
    "start_year": 2018,
    "start_month": 1,
    "end_year": None,
    "end_month": None,
    "is_current": True,
    "description": None,
}

AN_EDUCATION: dict[str, Any] = {
    "institution": "Damascus University",
    "degree": "BSc",
    "field_of_study": "Computer Science",
    "graduation_year": 2017,
    "description": None,
}

A_PROJECT: dict[str, Any] = {
    "name": "Ledger",
    "description": None,
    "project_url": None,
    "repository_url": None,
    "start_year": 2022,
    "start_month": 3,
    "end_year": None,
    "end_month": None,
}


FILLED_PROFILE: dict[str, Any] = {
    **EMPTY_PROFILE,
    "headline": "Backend engineer, 8 years",
    "summary": "Builds boring systems that stay up.",
    "location_key": "sy-damascus",
    "canonical_role_key": "backend-engineer",
    "experiences": [AN_EXPERIENCE],
    "educations": [AN_EDUCATION],
    "skills": [
        {"name": "Python", "years_experience": 8.0},
        {"name": "PostgreSQL", "years_experience": 6.0},
    ],
    "languages": [
        {"code": "ar", "proficiency": "native"},
        {"code": "en", "proficiency": "fluent"},
    ],
    "projects": [A_PROJECT],
}


def a_filled_profile(**changes: Any) -> dict[str, Any]:
    """A profile complete enough to apply with: skills, and a job."""
    return {**FILLED_PROFILE, **changes}


async def save_profile(browser: AsyncClient, profile: dict[str, Any]) -> Response:
    return await browser.put("/v1/candidates/me/profile", json=profile)


async def a_saved_profile(browser: AsyncClient, profile: dict[str, Any]) -> dict[str, Any]:
    response = await save_profile(browser, profile)
    assert response.status_code == 200, response.text
    saved: dict[str, Any] = response.json()
    return saved


async def my_profile(browser: AsyncClient) -> dict[str, Any]:
    response = await browser.get("/v1/candidates/me/profile")
    assert response.status_code == 200, response.text
    profile: dict[str, Any] = response.json()
    return profile


async def my_profile_draft(browser: AsyncClient, cv_id: UUID | str) -> Response:
    return await browser.get(f"/v1/candidates/me/cvs/{cv_id}/profile-draft")
