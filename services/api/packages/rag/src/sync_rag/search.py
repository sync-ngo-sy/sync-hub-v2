from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from sqlalchemy import Text, Uuid, column, func, literal_column, select, table

from sync_core.models import Candidate, CandidateProfileChunk

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy import ColumnElement
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_rag.embedding import Embedder

#: The eligibility view. It holds no email and no phone, so a result built from it has none
#: to leak — every column a match carries has to come from here.
SEARCH_PROFILES: Final = table(
    "candidate_search_profiles",
    column("candidate_id", Uuid),
    column("full_name", Text),
    column("avatar_url", Text),
    column("headline", Text),
    column("summary", Text),
    column("location", Text),
    column("preferred_language_code", Text),
    schema="public",
)

#: Inlined, not bound: as a parameter it reaches the driver as a `regconfig` with no codec.
ENGLISH: Final[ColumnElement[str]] = literal_column("'english'")


@dataclass(frozen=True, slots=True)
class SearchFilters:
    location: str | None = None
    language_code: str | None = None
    keywords: str | None = None


@dataclass(frozen=True, slots=True)
class CandidateMatch:
    candidate_id: UUID
    full_name: str | None
    avatar_url: str | None
    headline: str | None
    summary: str | None
    location: str | None
    preferred_language_code: str | None
    chunk_type: str | None
    chunk_text: str


class CandidateSearch:
    def __init__(self, session: AsyncSession, embedder: Embedder) -> None:
        self._db = session
        self._embedder = embedder

    async def find(self, query: str, *, filters: SearchFilters, limit: int) -> list[CandidateMatch]:
        (embedded,) = await self._embedder.embed([query])
        distance = CandidateProfileChunk.embedding.cosine_distance(list(embedded)).label("distance")
        best = (
            select(
                SEARCH_PROFILES.c.candidate_id,
                SEARCH_PROFILES.c.full_name,
                SEARCH_PROFILES.c.avatar_url,
                SEARCH_PROFILES.c.headline,
                SEARCH_PROFILES.c.summary,
                SEARCH_PROFILES.c.location,
                SEARCH_PROFILES.c.preferred_language_code,
                CandidateProfileChunk.chunk_type,
                CandidateProfileChunk.chunk_text,
                distance,
            )
            .join_from(
                CandidateProfileChunk,
                SEARCH_PROFILES,
                SEARCH_PROFILES.c.candidate_id == CandidateProfileChunk.candidate_id,
            )
            .distinct(CandidateProfileChunk.candidate_id)
            .order_by(CandidateProfileChunk.candidate_id, distance)
        )
        if filters.location:
            best = best.where(SEARCH_PROFILES.c.location.ilike(_containing(filters.location)))
        if filters.language_code:
            best = best.where(SEARCH_PROFILES.c.preferred_language_code == filters.language_code)
        if filters.keywords:
            best = best.join(Candidate, Candidate.id == SEARCH_PROFILES.c.candidate_id).where(
                Candidate.search_vector.op("@@")(
                    func.websearch_to_tsquery(ENGLISH, filters.keywords)
                )
            )

        ranked = best.subquery()
        rows = await self._db.execute(select(ranked).order_by(ranked.c.distance).limit(limit))
        return [
            CandidateMatch(
                candidate_id=row.candidate_id,
                full_name=row.full_name,
                avatar_url=row.avatar_url,
                headline=row.headline,
                summary=row.summary,
                location=row.location,
                preferred_language_code=row.preferred_language_code,
                chunk_type=row.chunk_type,
                chunk_text=row.chunk_text,
            )
            for row in rows
        ]


def _containing(value: str) -> str:
    escaped = value.replace("\\", r"\\").replace("%", r"\%").replace("_", r"\_")
    return f"%{escaped}%"
