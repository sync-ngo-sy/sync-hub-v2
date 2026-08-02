from __future__ import annotations

from typing import TYPE_CHECKING

from sync_api.search.payload import CandidateMatches, MatchedCandidate
from sync_core import get_logger
from sync_rag import CandidateSearch, ChunkType, SearchFilters

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_rag import CandidateMatch, Embedder

logger = get_logger(__name__)


class CandidateSearchService:
    def __init__(self, session: AsyncSession, embedder: Embedder) -> None:
        self._search = CandidateSearch(session, embedder)

    async def matches(
        self,
        query: str,
        *,
        location_key: str | None,
        language_code: str | None,
        keywords: str | None,
        limit: int,
    ) -> CandidateMatches:
        found = await self._search.find(
            query,
            filters=SearchFilters(
                location_key=location_key, language_code=language_code, keywords=keywords
            ),
            limit=limit,
        )
        logger.info("search.candidates_searched", results=len(found))
        return CandidateMatches(items=[_as_payload(match) for match in found])


def _as_payload(match: CandidateMatch) -> MatchedCandidate:
    return MatchedCandidate(
        candidate_id=match.candidate_id,
        full_name=match.full_name,
        avatar_url=match.avatar_url,
        headline=match.headline,
        summary=match.summary,
        location_key=match.location_key,
        location_name=match.location_name,
        preferred_language_code=match.preferred_language_code,
        matched_section=ChunkType(match.chunk_type) if match.chunk_type else None,
        matched_text=match.chunk_text,
    )
