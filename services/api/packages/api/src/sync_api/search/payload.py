from __future__ import annotations

from pydantic import BaseModel, Field

from sync_api.candidate_directory.payload import SearchableCandidate
from sync_rag import ChunkType


class MatchedCandidate(SearchableCandidate):
    """One Searchable Candidate, with the profile fragment that matched."""

    matched_section: ChunkType | None = Field(
        default=None, description="Which part of the profile the fragment came from."
    )
    matched_text: str = Field(
        description="The profile fragment that matched. Show it as the evidence for the hit."
    )


class CandidateMatches(BaseModel):
    """Searchable Candidates, closest match first."""

    items: list[MatchedCandidate]
    has_more: bool = Field(description="Whether the next `offset` would answer with anybody.")
    depth_reached: bool = Field(
        description="There are more matches and this search will not reach them. Ask a narrower "
        "question rather than paging further."
    )
