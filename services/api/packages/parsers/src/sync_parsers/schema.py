"""What the model is asked to read out of a CV.

`ParsedCv` is the whole contract with the extractor: the JSON schema the model is
constrained to (ADR-0006 — structured outputs, not a prompt asking nicely), the value the
adapter hands back, the JSON stored in `cvs.parsed_cv_data`, and the body the polling
endpoint answers with once a CV is `ready`.

**Field names match `sync_api.candidates.payload` on purpose.** The candidate reviews this
and posts the result to `PUT /v1/candidates/me/profile`; every name that differed between
the two would be a translation the review screen had to perform, and a place the two could
drift. `sync_ingestion` is what makes the match a promise rather than a coincidence — it
coerces every field to the limits `sync_core.profile` sets before the parse is stored.

**Nothing here constrains a value.** No ranges, no lengths, no required strings. Two
reasons, and they point the same way. The API's strict-schema subset supports only some of
what pydantic can express, so a constraint here is a constraint that may not survive the
trip. And a model that answers `start_year: 1291` should cost us that one field, not the
whole CV — which is exactly what a `ge=1900` here would cost, because `responses.parse`
validates before we ever see it. The limits are applied afterwards, where they can be.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from sync_core.models import LanguageProficiency


class ParsedModel(BaseModel):
    """Shared configuration for every shape the model fills in.

    `extra="forbid"` is what makes pydantic emit `additionalProperties: false`, which the
    strict-schema subset requires of every object in the document.
    """

    model_config = ConfigDict(extra="forbid")


class ParsedExperience(ParsedModel):
    """One job the CV describes."""

    job_title: str
    company_name: str | None = Field(description="Null when the CV does not name one.")
    start_year: int | None
    start_month: int | None
    end_year: int | None = Field(description="Null for a job the candidate still holds.")
    end_month: int | None
    is_current: bool = Field(description="The CV presents this as the candidate's job today.")
    description: str | None = Field(description="What the CV says they did, in its own words.")


class ParsedEducation(ParsedModel):
    """One qualification the CV describes."""

    institution: str
    degree: str | None
    field_of_study: str | None
    graduation_year: int | None
    description: str | None


class ParsedSkill(ParsedModel):
    """One Canonical skill the CV evidences.

    `name` must be a Canonical skill spelled exactly as the prompt listed it. The backend
    checks that rather than trusting it (ADR-0006): a name that is not in the taxonomy is
    moved to `unmapped_skills`, where it is reviewed and never reaches Screening.
    """

    name: str = Field(description="Exactly as spelled in the list of Canonical skills.")
    years_experience: float | None = Field(
        description="Years of it, if the CV supports a figure. Null when it does not — a "
        "guess here becomes a number a recruiter filters on."
    )


class ParsedLanguage(ParsedModel):
    """One language the CV claims, and how well."""

    code: str = Field(description="Exactly as spelled in the list of language codes.")
    proficiency: LanguageProficiency = Field(
        description="The CV's own claim, mapped to the nearest of these. Use `fluent` for a "
        "language described as professional or business level."
    )


class ParsedProject(ParsedModel):
    """One thing the CV says the candidate built."""

    name: str
    description: str | None
    project_url: str | None
    repository_url: str | None
    start_year: int | None
    start_month: int | None
    end_year: int | None
    end_month: int | None


class ParsedCv(ParsedModel):
    """Everything read out of one CV.

    Every field is present in the model's answer — the strict-schema subset has no optional
    properties, only nullable ones — so "the CV does not say" is `null` or an empty list
    throughout, never an absent key.
    """

    full_name: str | None = Field(description="The candidate's name as the CV gives it.")
    email: str | None
    phone: str | None
    detected_language: str | None = Field(
        description="The language the CV itself is written in, as an ISO 639-1 code."
    )

    headline: str | None = Field(
        description="The one-line professional title the CV leads with, if it has one.",
        examples=["Backend engineer, 8 years"],
    )
    summary: str | None = Field(description="The CV's own professional summary, if it has one.")
    location: str | None = Field(description="Where the candidate is, as the CV puts it.")

    experiences: list[ParsedExperience] = Field(description="Every job, most recent first.")
    educations: list[ParsedEducation] = Field(description="Every qualification, most recent first.")
    skills: list[ParsedSkill] = Field(
        description="Every Canonical skill the CV evidences, by its exact name."
    )
    languages: list[ParsedLanguage] = Field(description="Every language the CV claims.")
    projects: list[ParsedProject] = Field(description="Every project the CV describes.")

    unmapped_skills: list[str] = Field(
        description="Every skill the CV names that is not in the Canonical list, in the CV's "
        "own words. The candidate sees these at review; they never reach Screening."
    )
