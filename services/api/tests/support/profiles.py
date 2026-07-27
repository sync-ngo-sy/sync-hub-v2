"""Looking at what a profile save left behind.

Unlike the other support modules, these read Postgres directly — deliberately. Two of the
things the save promises are not observable over HTTP at all: that a replaced section
leaves no rows behind, and that however many times a candidate saves, the embedding worker
is left exactly one job to do. Both live in tables no route exposes, so the only place to
assert them is the database, on the real schema with the real triggers.
"""

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

#: Every child table a save swaps, by the section of the payload that fills it.
SECTIONS: dict[str, Any] = {
    "experiences": CandidateExperience,
    "educations": CandidateEducation,
    "skills": CandidateSkill,
    "languages": CandidateLanguage,
    "projects": CandidateProject,
}


async def my_id(browser: AsyncClient) -> UUID:
    """The signed-in candidate's id, asked for the way the SPA asks for it."""
    response = await browser.get("/v1/auth/me")
    assert response.status_code == 200, response.text
    return UUID(response.json()["id"])


async def section_row_counts(session: AsyncSession, candidate_id: UUID) -> dict[str, int]:
    """How many rows each section actually has — the ones a replaced profile left behind
    included, which is the point of counting rather than reading the payload back."""
    counts = {}
    for section, entity in SECTIONS.items():
        rows = await session.scalar(
            select(func.count()).select_from(entity).where(entity.candidate_id == candidate_id)
        )
        counts[section] = int(rows or 0)
    return counts


@dataclass(frozen=True, slots=True)
class EmbeddingJob:
    """What the re-embed queue said at one moment.

    A snapshot rather than the row: reading the same row twice hands back the same ORM
    instance, so a test holding "how it was before" would find it had quietly become "how
    it is now" — and comparing the two would compare a value with itself.
    """

    dirty: bool
    revision: int
    claimed_at: datetime | None


async def embedding_jobs(session: AsyncSession, candidate_id: UUID) -> list[EmbeddingJob]:
    """Every re-embed job row the candidate has. The contract says exactly one, always."""
    session.expire_all()  # written by triggers, so a cached row is a stale row
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
    """Put a current CV on the candidate, without the pipeline that will one day do it.

    Written straight into Postgres because uploading and parsing a CV is a later ticket
    (#7) and none of it exists yet. What is under test here is the Searchable flag, whose
    rule spans two rows: the CHECK sees `current_cv_id`, and the backend owns the rest of
    it — hence `parsing_status`, which is the half only these tests can arrange.
    """
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
    """An otherwise-empty profile with the named sections filled in."""
    return {**EMPTY_PROFILE, **changes}


#: Every section present and empty — what a candidate has before they have written anything,
#: and the base every payload in the tests is a variation on.
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
