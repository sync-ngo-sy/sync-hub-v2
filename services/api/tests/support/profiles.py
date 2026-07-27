from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
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

if TYPE_CHECKING:
    from httpx import AsyncClient
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
    )
    session.add(cv)
    await session.flush()
    await session.execute(
        update(Candidate).where(Candidate.id == candidate_id).values(current_cv_id=cv.id)
    )
    await session.commit()
    return cv.id


def a_profile(**changes: Any) -> dict[str, Any]:
    return {**EMPTY_PROFILE, **changes}


EMPTY_PROFILE: dict[str, Any] = {
    "headline": None,
    "summary": None,
    "location": None,
    "preferred_language_code": None,
    "is_searchable": False,
    "experiences": [],
    "educations": [],
    "skills": [],
    "languages": [],
    "projects": [],
}


async def my_profile(browser: AsyncClient) -> dict[str, Any]:
    response = await browser.get("/v1/candidates/me/profile")
    assert response.status_code == 200, response.text
    profile: dict[str, Any] = response.json()
    return profile
