from __future__ import annotations

from typing import TYPE_CHECKING

from sync_api.search.payload import CandidateMatches, MatchedCandidate
from sync_core import get_logger
from sync_rag import CandidateSearch, ChunkType

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.tenants import ActingRecruiter
    from sync_core.discovery import CandidateFilters
    from sync_rag import CandidateMatch, Embedder

logger = get_logger(__name__)


class CandidateSearchService:
    def __init__(self, session: AsyncSession, embedder: Embedder) -> None:
        self._search = CandidateSearch(session, embedder)

    async def matches(
        self,
        recruiter: ActingRecruiter,
        query: str,
        *,
        filters: CandidateFilters,
        keywords: str | None,
        limit: int,
        offset: int,
    ) -> CandidateMatches:
        ranked = await self._search.find(
            query,
            tenant_id=recruiter.tenant.id,
            filters=filters,
            keywords=keywords,
            limit=limit,
            offset=offset,
        )
        logger.info("search.candidates_searched", results=len(ranked.matches))
        return CandidateMatches(
            items=[_as_payload(match) for match in ranked.matches],
            has_more=ranked.has_more,
            depth_reached=ranked.depth_reached,
        )


def _as_payload(match: CandidateMatch) -> MatchedCandidate:
    return MatchedCandidate(
        candidate_id=match.candidate_id,
        full_name=match.full_name,
        avatar_url=match.avatar_url,
        headline=match.headline,
        summary=match.summary,
        location_key=match.location_key,
        location_name=match.location_name,
        canonical_role_key=match.canonical_role_key,
        canonical_role_name=match.canonical_role_name,
        total_experience_years=match.total_experience_years,
        preferred_language_code=match.preferred_language_code,
        in_talent_pool=match.in_talent_pool,
        matched_section=ChunkType(match.chunk_type) if match.chunk_type else None,
        matched_text=match.chunk_text,
    )
