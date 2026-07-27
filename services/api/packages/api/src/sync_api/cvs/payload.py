from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from sync_core.models import CvParsingStatus
from sync_parsers import ParsedCv


class Cv(BaseModel):
    """One uploaded CV, and how far the platform has got with it."""

    id: UUID
    display_name: str = Field(description="The name of the file the candidate uploaded.")
    parsing_status: CvParsingStatus = Field(
        description="The authoritative state of this CV. Poll until it leaves `processing`."
    )
    parsing_error: str | None = Field(
        default=None, description="Why the parse failed, when it did. Null otherwise."
    )
    detected_language: str | None = Field(
        default=None, description="The language the CV is written in, once it has been read."
    )
    is_current: bool = Field(
        description="Whether this is the CV the candidate applies and is found with."
    )
    created_at: datetime
    parsed_at: datetime | None = None

    parsed_cv: ParsedCv | None = Field(
        default=None,
        description="What the AI read out of the CV — present only once `parsing_status` is "
        "`ready`. Skills are Canonical skills; everything else the CV named is in "
        "`unmapped_skills` for the candidate to review.",
    )


class CvDownloadLink(BaseModel):
    """Where to fetch the original file, for as long as the link lasts."""

    url: str = Field(description="A signed URL. Anyone holding it can read the file.")
    expires_in_seconds: int = Field(
        description="How long the URL stays good for. Ask again rather than storing it."
    )
