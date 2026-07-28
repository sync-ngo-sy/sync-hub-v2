from __future__ import annotations

from typing import Final

from pydantic import BaseModel, ConfigDict, Field, field_validator

LOWEST_PERCENTAGE: Final = 0.0

HIGHEST_PERCENTAGE: Final = 100.0


class AssessedMatch(BaseModel):
    """One reading of how well an Application answers its Job. Advice, never a verdict."""

    # `extra="forbid"` emits `additionalProperties: false`, which the strict-schema subset
    # requires of every object in the document.
    model_config = ConfigDict(extra="forbid")

    match_percentage: float = Field(
        description="How much of what the job asks for the application evidences, from 0 to "
        "100. Not a probability, and not a recommendation."
    )
    explanation: str = Field(
        description="Two or three sentences a recruiter can act on, naming the evidence they "
        "rest on."
    )
    strengths: list[str] = Field(
        description="Short phrases, one requirement each, that the application answers well."
    )
    gaps: list[str] = Field(
        description="Short phrases, one requirement each, that it does not answer, or does "
        "not say enough about."
    )

    @field_validator("match_percentage")
    @classmethod
    def _within_range(cls, percentage: float) -> float:
        """The strict-schema subset carries no `minimum`/`maximum`, so the range the column
        enforces is held here instead — a model that overshoots is clamped, not a 500."""
        return min(HIGHEST_PERCENTAGE, max(LOWEST_PERCENTAGE, percentage))
