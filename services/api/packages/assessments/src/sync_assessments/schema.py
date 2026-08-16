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
        description="How strong this applicant is for this job, from 0 to 100. About half of "
        "it is how well they answer what the job asks for and the rest is how strong the "
        "application is in itself. A judgement of degree: not a probability, not a "
        "recommendation, and not a second ruling on whether they meet the criteria."
    )
    explanation: str = Field(
        description="Two or three sentences a recruiter can act on, naming the evidence they "
        "rest on."
    )
    strengths: list[str] = Field(
        description="Short phrases, one point each, for what makes this a strong application "
        "— what it answers well, and what it evidences beyond that."
    )
    gaps: list[str] = Field(
        description="Short phrases, one point each, for what weakens it — what it does not "
        "answer, and what it does not say enough about."
    )

    @field_validator("match_percentage")
    @classmethod
    def _within_range(cls, percentage: float) -> float:
        """The strict-schema subset carries no `minimum`/`maximum`, so the range the column
        enforces is held here instead — a model that overshoots is clamped, not a 500."""
        return min(HIGHEST_PERCENTAGE, max(LOWEST_PERCENTAGE, percentage))
