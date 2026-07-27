from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, Field, model_validator

from sync_api.text import (
    LanguageCode,
    Line,
    OptionalLine,
    OptionalLink,
    OptionalParagraph,
)
from sync_core.models import LanguageProficiency
from sync_core.profile import (
    EARLIEST_YEAR,
    LATEST_YEAR,
    MAX_ENTRIES,
    MAX_YEARS_EXPERIENCE,
)

Year = Annotated[int, Field(ge=EARLIEST_YEAR, le=LATEST_YEAR)]
Month = Annotated[int, Field(ge=1, le=12)]

YearsOfExperience = Annotated[float, Field(ge=0, le=MAX_YEARS_EXPERIENCE)]


def _section(description: str) -> Any:
    return Field(default_factory=list, max_length=MAX_ENTRIES, description=description)


class DatedRange(BaseModel):
    """Something that ran from roughly one month to roughly another, or still runs."""

    start_year: Year | None = None
    start_month: Month | None = None
    end_year: Year | None = None
    end_month: Month | None = None

    @model_validator(mode="after")
    def _ends_after_it_starts(self) -> DatedRange:
        """The `*_ordered` CHECK, restated. Only comparable when both years are known."""
        if self.start_year is None or self.end_year is None:
            return self
        if (self.end_year, self.end_month or 12) < (self.start_year, self.start_month or 1):
            raise ValueError("the end of a period cannot come before its start")
        return self


class ProfileExperience(DatedRange):
    """One job."""

    job_title: Line
    company_name: OptionalLine = None
    is_current: bool = Field(default=False, description="A job with no end, still going.")
    description: OptionalParagraph = None

    @model_validator(mode="after")
    def _current_work_has_not_ended(self) -> ProfileExperience:
        """The `cexp_current_has_no_end` CHECK, restated."""
        if self.is_current and (self.end_year is not None or self.end_month is not None):
            raise ValueError("a current job cannot have an end date")
        return self


class ProfileEducation(BaseModel):
    """One qualification."""

    institution: Line
    degree: OptionalLine = None
    field_of_study: OptionalLine = None
    graduation_year: Year | None = None
    description: OptionalParagraph = None


class ProfileSkill(BaseModel):
    """One Canonical skill, by its exact name, and how long the candidate has been doing it."""

    name: Line = Field(description="The Canonical skill's exact name.", examples=["Python"])
    years_experience: YearsOfExperience | None = Field(
        default=None, description="Stored to one decimal place. Null means unstated."
    )


class ProfileLanguage(BaseModel):
    """One language the candidate speaks, and how well."""

    code: LanguageCode
    proficiency: LanguageProficiency


class ProfileProject(DatedRange):
    """One thing the candidate built."""

    name: Line
    description: OptionalParagraph = None
    project_url: OptionalLink = None
    repository_url: OptionalLink = None


class CandidateProfile(BaseModel):
    """Everything a Candidate says about themselves. A `GET` body is a valid `PUT` body."""

    headline: OptionalLine = Field(default=None, examples=["Backend engineer, 8 years"])
    summary: OptionalParagraph = None
    location: OptionalLine = Field(default=None, examples=["Damascus, Syria"])
    preferred_language_code: LanguageCode | None = None
    is_searchable: bool = Field(
        default=False,
        description="Opt in to cross-tenant Global search. Requires a current, ready CV.",
    )

    experiences: list[ProfileExperience] = _section("Jobs, in the candidate's own order.")
    educations: list[ProfileEducation] = _section("Qualifications, in the candidate's own order.")
    skills: list[ProfileSkill] = _section("Canonical skills, in the candidate's own order.")
    languages: list[ProfileLanguage] = _section("Languages spoken, in the candidate's own order.")
    projects: list[ProfileProject] = _section("Projects, in the candidate's own order.")

    @model_validator(mode="after")
    def _one_entry_per_skill_and_language(self) -> CandidateProfile:
        # Caught here rather than by the composite primary keys, which would refuse the save
        # half way through with a message about a constraint.
        _refuse_repeats([skill.name for skill in self.skills], "skill")
        _refuse_repeats([language.code for language in self.languages], "language")
        return self


def _refuse_repeats(names: list[str], singular: str) -> None:
    repeated = sorted({name for name in names if names.count(name) > 1})
    if repeated:
        raise ValueError(f"one entry per {singular}; repeated: {', '.join(repeated)}")
