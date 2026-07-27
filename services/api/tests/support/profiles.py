from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import func, select, update

from sync_core.models import (
    Candidate,
    CandidateEducation,
    CandidateEmbeddingJob,
    CandidateExperience,
    CandidateLanguage,
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


async def embedding_jobs(session: AsyncSession, candidate_id: UUID) -> list[EmbeddingJob]:
    session.expire_all()
    rows = await session.scalars(
        select(CandidateEmbeddingJob).where(CandidateEmbeddingJob.candidate_id == candidate_id)
    )
    return [
        EmbeddingJob(dirty=row.dirty, revision=row.revision, claimed_at=row.claimed_at)
        for row in rows
    ]


async def give_a_current_cv(
    session: AsyncSession,
    candidate_id: UUID,
    *,
    parsing_status: CvParsingStatus = CvParsingStatus.READY,
) -> UUID:
    cv = Cv(
        candidate_id=candidate_id,
        display_name="cv.pdf",
        storage_path=f"{candidate_id}/cv.pdf",
        file_hash=f"hash-{candidate_id}",
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
