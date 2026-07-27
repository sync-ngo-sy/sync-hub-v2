"""What a Candidate's professional profile looks like on the wire.

One model, both directions. What `GET` returns is exactly what `PUT` accepts, so the SPA
can hand back the document it was given with the parts the candidate edited changed and
nothing else. Two things follow from that.

**No child row carries an id.** A save replaces them, so an id would promise a stability
that does not exist. Order is the array's order instead — position in the list *is*
`sort_order`, in and out.

**Every rule the schema would refuse is restated here.** The `candidate_*` tables carry
CHECK constraints for date ranges, months, years and a current job with no end; a request
that breaks one of them is a client error, and a client error should name the field it is
about rather than arrive as Postgres declining to write a row. The constraints remain the
authority (ADR-0001) — this is the same rule said early, where it can be said usefully.
"""

from __future__ import annotations

from typing import Annotated, Any, Final

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints, model_validator

from sync_core.models import LanguageProficiency

#: How many entries one section may carry. Not a schema limit — the schema has none — but
#: the profile is embedded whole for Global search, and a section nobody could have typed
#: is a way to make that work unboundedly expensive.
MAX_ENTRIES: Final = 50

#: `candidate_skills.years_experience` is `numeric(4,1)`: anything larger overflows the
#: column, and a second decimal place is rounded away on the way in.
MAX_YEARS_EXPERIENCE: Final = 999.9


def _blank_as_unset(value: object) -> object:
    """An empty input on a form means "not set", not "set to nothing"."""
    return None if isinstance(value, str) and not value.strip() else value


Line = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Paragraph = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
Link = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

OptionalLine = Annotated[Line | None, BeforeValidator(_blank_as_unset)]
OptionalParagraph = Annotated[Paragraph | None, BeforeValidator(_blank_as_unset)]
OptionalLink = Annotated[Link | None, BeforeValidator(_blank_as_unset)]

#: The ranges the `candidate_*` CHECK constraints enforce.
Year = Annotated[int, Field(ge=1900, le=2100)]
Month = Annotated[int, Field(ge=1, le=12)]

LanguageCode = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=8),
    Field(description="A code from the platform's `languages` table.", examples=["en"]),
]

YearsOfExperience = Annotated[float, Field(ge=0, le=MAX_YEARS_EXPERIENCE)]


def _section(description: str) -> Any:
    """One repeated section of the profile, in the candidate's own order."""
    return Field(default_factory=list, max_length=MAX_ENTRIES, description=description)


class DatedRange(BaseModel):
    """Something that ran from roughly one month to roughly another, or still runs.

    Every part is optional because a CV is: "2019 to present" and "March 2019" are both
    things people write, and a profile that refused them would be refusing its own source
    material.
    """

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
    """One Canonical skill, and how long the candidate has been doing it.

    Named rather than identified: a Canonical skill *is* its one spelling, and the CV parse
    speaks in those names — so the review flow can post back what it read.
    """

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
    """Everything a Candidate says about themselves professionally.

    One model for both directions: a `GET` body is a valid `PUT` body, unchanged.
    """

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
        """Both are keyed by what they name, so a repeat is a form bug, not a second entry.

        Caught here rather than left to the composite primary keys, which would refuse the
        save half way through it with a message about a constraint.
        """
        _refuse_repeats([skill.name for skill in self.skills], "skill")
        _refuse_repeats([language.code for language in self.languages], "language")
        return self


def _refuse_repeats(names: list[str], singular: str) -> None:
    repeated = sorted({name for name in names if names.count(name) > 1})
    if repeated:
        raise ValueError(f"one entry per {singular}; repeated: {', '.join(repeated)}")
