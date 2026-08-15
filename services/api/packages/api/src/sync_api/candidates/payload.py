from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, Field, model_validator

from sync_api.text import (
    CanonicalRoleKey,
    LanguageCode,
    Line,
    LocationKey,
    OptionalIsoCountry,
    OptionalLine,
    OptionalLink,
    OptionalParagraph,
)
from sync_core.models import LanguageProficiency
from sync_core.phone import read
from sync_core.profile import (
    EARLIEST_YEAR,
    LATEST_YEAR,
    MAX_ENTRIES,
    MAX_YEARS_EXPERIENCE,
    YEARS_EXPERIENCE_DECIMALS,
)

Year = Annotated[int, Field(ge=EARLIEST_YEAR, le=LATEST_YEAR)]
Month = Annotated[int, Field(ge=1, le=12)]


def _to_the_stored_precision(years: float) -> float:
    return float(
        Decimal(str(years)).quantize(
            Decimal(1).scaleb(-YEARS_EXPERIENCE_DECIMALS), rounding=ROUND_HALF_UP
        )
    )


YearsOfExperience = Annotated[
    float, Field(ge=0, le=MAX_YEARS_EXPERIENCE), AfterValidator(_to_the_stored_precision)
]


def _deduplicated(names: list[str]) -> list[str]:
    kept: dict[str, str] = {}
    for name in names:
        kept.setdefault(name.lower(), name)
    return list(kept.values())


UnmappedSkills = Annotated[list[Line], AfterValidator(_deduplicated)]


def _section(description: str) -> Any:
    return Field(default_factory=list, max_length=MAX_ENTRIES, description=description)


def _refuse_an_end_before_its_start(
    start_year: int | None, start_month: int | None, end_year: int | None, end_month: int | None
) -> None:
    """The `*_ordered` CHECK, restated. Only comparable when both years are known."""
    if start_year is None or end_year is None:
        return
    if (end_year, end_month or 12) < (start_year, start_month or 1):
        raise ValueError("the end of a period cannot come before its start")


def _refuse_an_end_on_current_work(
    is_current: bool, end_year: int | None, end_month: int | None
) -> None:
    """The `cexp_current_has_no_end` CHECK, restated. Holds for a draft as much as for a profile:
    a job still held is exactly a job with no end, which is what lets the experience rule read
    one from the other."""
    if is_current and (end_year is not None or end_month is not None):
        raise ValueError("a current job cannot have an end date")


class DatedRange(BaseModel):
    """Something that ran from roughly one month to roughly another, or still runs."""

    start_year: Year | None = None
    start_month: Month | None = None
    end_year: Year | None = None
    end_month: Month | None = None

    @model_validator(mode="after")
    def _ends_after_it_starts(self) -> DatedRange:
        _refuse_an_end_before_its_start(
            self.start_year, self.start_month, self.end_year, self.end_month
        )
        return self


class ProfileExperience(BaseModel):
    """One job, which — unlike a project — is always dated.

    Total experience is one stored number derived from these entries, so a job nobody can date
    would make that number a lie rather than an approximation. A start year always, and an end
    year unless the job is still held. That is why these dates are their own type rather than
    the optional `DatedRange` a project uses.
    """

    job_title: Line
    company_name: OptionalLine = None
    start_year: Year
    start_month: Month | None = None
    end_year: Year | None = Field(default=None, description="Absent only on a job still held.")
    end_month: Month | None = None
    is_current: bool = Field(default=False, description="A job with no end, still going.")
    description: OptionalParagraph = None

    @model_validator(mode="after")
    def _ends_after_it_starts(self) -> ProfileExperience:
        _refuse_an_end_before_its_start(
            self.start_year, self.start_month, self.end_year, self.end_month
        )
        return self

    @model_validator(mode="after")
    def _current_work_has_not_ended(self) -> ProfileExperience:
        _refuse_an_end_on_current_work(self.is_current, self.end_year, self.end_month)
        return self

    @model_validator(mode="after")
    def _finished_work_has_an_end(self) -> ProfileExperience:
        """The `cexp_finished_work_has_an_end` CHECK, restated."""
        if not self.is_current and self.end_year is None:
            raise ValueError("a job that is not current has to say what year it ended")
        return self


class DraftExperience(DatedRange):
    """One job on a draft, where the CV may not have dated it.

    Undated like a draft skill has no years: the candidate fills the dates in at review, and the
    profile will not save until they have. Dropping the entry instead would throw away the job
    title, the company and the description the CV did give.
    """

    job_title: Line
    company_name: OptionalLine = None
    is_current: bool = Field(default=False, description="A job with no end, still going.")
    description: OptionalParagraph = None

    @model_validator(mode="after")
    def _current_work_has_not_ended(self) -> DraftExperience:
        _refuse_an_end_on_current_work(self.is_current, self.end_year, self.end_month)
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
    years_experience: YearsOfExperience = Field(
        description="Stored to one decimal place. Required: blank and `1` are opposites, not "
        "neighbours, and only the candidate can say which."
    )


class DraftSkill(BaseModel):
    """One Canonical skill on a draft, where the years may not be known yet."""

    name: Line = Field(description="The Canonical skill's exact name.", examples=["Python"])
    years_experience: YearsOfExperience | None = Field(
        default=None,
        description="Null for a skill the CV newly names: the candidate fills it in before the "
        "profile will save.",
    )


class ProfileLanguage(BaseModel):
    """One language the candidate speaks, and how well."""

    code: LanguageCode
    proficiency: LanguageProficiency


# Repeats are caught here rather than by the composite primary keys, which would refuse the save
# half way through with a message about a constraint.
def _refuse_repeats(names: list[str], singular: str) -> None:
    repeated = sorted({name for name in names if names.count(name) > 1})
    if repeated:
        raise ValueError(f"one entry per {singular}; repeated: {', '.join(repeated)}")


def _one_entry_per_skill[SkillEntry: (ProfileSkill, DraftSkill)](
    skills: list[SkillEntry],
) -> list[SkillEntry]:
    _refuse_repeats([skill.name for skill in skills], "skill")
    return skills


def _one_entry_per_language(languages: list[ProfileLanguage]) -> list[ProfileLanguage]:
    _refuse_repeats([language.code for language in languages], "language")
    return languages


type OneEntryPerSkill[SkillEntry: (ProfileSkill, DraftSkill)] = Annotated[
    list[SkillEntry], AfterValidator(_one_entry_per_skill)
]
OneEntryPerLanguage = Annotated[list[ProfileLanguage], AfterValidator(_one_entry_per_language)]


class ProfileProject(DatedRange):
    """One thing the candidate built."""

    name: Line
    description: OptionalParagraph = None
    project_url: OptionalLink = None
    repository_url: OptionalLink = None


class ProfileClaims(BaseModel):
    """The fields a live profile and a draft of one share, whatever their skills look like.

    The Phone is not among them: a profile holds a number the platform has read, and a draft
    holds whatever a CV wrote — including something nobody could dial.
    """

    full_name: Line = Field(examples=["Amina Haddad"])
    headline: OptionalLine = Field(default=None, examples=["Backend engineer, 8 years"])
    summary: OptionalParagraph = None
    location_key: LocationKey = None
    canonical_role_key: CanonicalRoleKey = Field(
        default=None,
        description="What kind of practitioner the candidate is, by the key `/roles` lists. "
        "Chosen from that list or left unset, never typed. CV parsing proposes one; this is "
        "the candidate's own answer.",
        examples=["frontend-engineer"],
    )
    is_searchable: bool = Field(
        default=False,
        description="Opt in to cross-tenant Global search. Requires a current, ready CV.",
    )

    educations: list[ProfileEducation] = _section("Qualifications, in the candidate's own order.")
    languages: OneEntryPerLanguage = _section("Languages spoken, in the candidate's own order.")
    projects: list[ProfileProject] = _section("Projects, in the candidate's own order.")

    unmapped_skills: UnmappedSkills = _section(
        "Skills the candidate claims that the platform has no Canonical name for. Kept as "
        "typed, deduplicated case-insensitively. Recruiters read them; Screening never does."
    )


class CandidateProfile(ProfileClaims):
    """Everything a Candidate says about themselves. A `GET` body is a valid `PUT` body."""

    phone: OptionalLine = Field(
        default=None,
        description="Stored in E.164. Sent any way at all — spaces, brackets, or the national "
        "form `phone_country` writes it in — and read back the one way.",
        examples=["+963115550134"],
    )
    phone_country: OptionalIsoCountry = None

    experiences: list[ProfileExperience] = _section(
        "Jobs, in the candidate's own order. Each one dated."
    )
    skills: OneEntryPerSkill[ProfileSkill] = _section(
        "Canonical skills, in the candidate's own order."
    )
    total_experience_years: int = Field(
        default=0,
        ge=0,
        json_schema_extra={"readOnly": True},
        description="Whole years of work, derived from `experiences` on every save: jobs held "
        "at once count once, and six months or more round up to a year. Read-only — a `PUT` "
        "carries it back so a `GET` body stays a valid one, and it is ignored. A wrong number "
        "is corrected by fixing the work history.",
    )

    @model_validator(mode="after")
    def _a_number_its_country_can_dial(self) -> CandidateProfile:
        """One answer in two columns: half of it is no answer, and a number that country cannot
        dial is not one either. The same rules the field applied as it was typed."""
        if self.phone is None and self.phone_country is None:
            return self
        if self.phone is None or self.phone_country is None:
            raise ValueError("a phone number and the country it belongs to are given together")
        stored = read(self.phone, self.phone_country)
        if stored is None:
            raise ValueError(f"that is not a number {self.phone_country} can dial")
        self.phone = stored.number
        return self


class ExperienceTotalRequest(BaseModel):
    experiences: list[ProfileExperience] = _section("Jobs to calculate as one work history.")


class ExperienceTotal(BaseModel):
    total_experience_years: int = Field(ge=0)


class ProfileDraft(ProfileClaims):
    """A profile computed from a parsed CV, saved nowhere. `PUT` it back to make it the profile.

    Distinct from `CandidateProfile` because a draft is incomplete by nature: a skill the CV
    newly names has no years, a job it never dated has no dates, and a number nobody could dial
    is still what the CV said, until the candidate types them.
    """

    phone: OptionalLine = Field(
        default=None,
        description="In E.164 when the CV wrote a number the platform could read, and exactly "
        "as the CV wrote it when it did not — so a value is never quietly dropped.",
    )
    phone_country: OptionalIsoCountry = Field(
        default=None, description="Null when the CV's number named no country."
    )

    experiences: list[DraftExperience] = _section(
        "Jobs the CV describes, in its own order — those it did not date with their dates null."
    )
    skills: OneEntryPerSkill[DraftSkill] = _section(
        "Every skill already on the profile, years and all, plus the ones this CV names that "
        "were not there — those with `years_experience` null."
    )
