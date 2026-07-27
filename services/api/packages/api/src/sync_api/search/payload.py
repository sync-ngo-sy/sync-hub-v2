from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from sync_rag import ChunkType


class MatchedCandidate(BaseModel):
    """One Searchable Candidate, with the profile fragment that matched."""

    candidate_id: UUID
    full_name: str | None = None
    avatar_url: str | None = None
    headline: str | None = None
    summary: str | None = None
    location: str | None = None
    preferred_language_code: str | None = None
    matched_section: ChunkType | None = Field(
        default=None, description="Which part of the profile the fragment came from."
    )
    matched_text: str = Field(
        description="The profile fragment that matched. Show it as the evidence for the hit."
    )


class CandidateMatches(BaseModel):
    """Searchable Candidates, closest match first."""

    items: list[MatchedCandidate]
