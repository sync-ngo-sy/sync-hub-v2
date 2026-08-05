from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from sync_api.candidates.payload import (
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
)
from sync_api.text import LocationName


class DiscoveredCandidate(BaseModel):
    """One Candidate as a list shows them: no phone and no email, which only a profile carries."""

    candidate_id: UUID
    full_name: str | None = None
    avatar_url: str | None = None
    headline: str | None = None
    summary: str | None = None
    location_key: str | None = None
    location_name: LocationName = None
    canonical_role_key: str | None = None
    canonical_role_name: str | None = Field(
        default=None, description="What `canonical_role_key` is called."
    )
    total_experience_years: int = Field(
        description="Whole years of work, derived from their own history."
    )
    preferred_language_code: str | None = None
    in_talent_pool: bool = Field(
        description="Whether the acting Tenant has already saved them. Nobody else's pool."
    )


class CandidateDirectoryPage(BaseModel):
    """One page of the Candidate directory, newest first."""

    items: list[DiscoveredCandidate]
    next_cursor: str | None = Field(
        default=None,
        description="Send back as `cursor` for the following page. Null on the last page.",
    )


class CandidateRecord(DiscoveredCandidate):
    """One Candidate, whole. The only place a phone or an email is readable."""

    phone: str | None = None
    email: str | None = Field(
        default=None,
        description="Read from the authentication store, which is the only place a confirmed "
        "address lives.",
    )
    experiences: list[ProfileExperience] = Field(default_factory=list)
    educations: list[ProfileEducation] = Field(default_factory=list)
    skills: list[ProfileSkill] = Field(default_factory=list)
    languages: list[ProfileLanguage] = Field(default_factory=list)
    projects: list[ProfileProject] = Field(default_factory=list)
