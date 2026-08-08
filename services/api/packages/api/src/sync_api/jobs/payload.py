from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Final
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, model_validator

from sync_api.text import LanguageCode, Line, LocationKey, LocationName, Paragraph
from sync_core.models import (
    ApplicationQuestionType,
    EmploymentType,
    JobStatus,
    LanguageProficiency,
    SkillImportance,
    WorkMode,
)
from sync_core.profile import MAX_ENTRIES, MAX_YEARS_EXPERIENCE

#: `job_skills.minimum_years` is an int, and a requirement past this is a typo, not a bar.
MAX_MINIMUM_YEARS: Final = 99

Expiry = Annotated[
    AwareDatetime | None,
    Field(description="When the Job stops being public. Null means it stays up until closed."),
]

EmploymentTypeChoice = Annotated[
    EmploymentType | None,
    Field(
        description="What the contract is, from a fixed set. Null says nothing about it.",
        examples=[EmploymentType.FULL_TIME],
    ),
]

WorkModeChoice = Annotated[
    WorkMode | None,
    Field(
        description="How much of the work happens where the team is. It never stands in for "
        "`location_key` — a remote Job still has a Location. Null says nothing about it.",
        examples=[WorkMode.REMOTE],
    ),
]


def _section(description: str) -> Any:
    return Field(default_factory=list, max_length=MAX_ENTRIES, description=description)


class JobSkillRequirement(BaseModel):
    """One Canonical skill the Job asks for, and how much of it."""

    name: Line = Field(description="The Canonical skill's exact name.", examples=["Python"])
    importance: SkillImportance = Field(
        default=SkillImportance.PREFERRED,
        description="Only `required` can disqualify an applicant.",
    )
    minimum_years: int | None = Field(
        default=None,
        ge=0,
        le=MAX_MINIMUM_YEARS,
        description="Years of it an applicant needs. Null asks for the skill at any depth.",
    )


class JobLanguageRequirement(BaseModel):
    """One language an applicant has to speak, and how well."""

    code: LanguageCode
    minimum_proficiency: LanguageProficiency


class JobQuestion(BaseModel):
    """One question every applicant answers."""

    question_text: Line
    question_type: ApplicationQuestionType
    is_required: bool = Field(
        default=True, description="A required question has to be answered to apply."
    )
    accepted_boolean_answer: bool | None = Field(
        default=None,
        description="The answer that passes Screening, making this a knockout question. "
        "`yes_no` only; null asks without judging.",
    )

    @model_validator(mode="after")
    def _only_a_yes_no_question_has_an_accepted_answer(self) -> JobQuestion:
        """The `jaq_boolean_answer_only_for_yes_no` CHECK, restated."""
        if (
            self.accepted_boolean_answer is not None
            and self.question_type is not ApplicationQuestionType.YES_NO
        ):
            raise ValueError("only a yes_no question can carry an accepted answer")
        return self


class JobQuestionView(JobQuestion):
    """A stored question, which an Application's answer refers to by id."""

    id: UUID


class PublicJobQuestion(BaseModel):
    """A question as an applicant meets it — never the answer that would pass it."""

    id: UUID
    question_text: str
    question_type: ApplicationQuestionType
    is_required: bool


class JobCriteria(BaseModel):
    """The bar an applicant is judged against. Replaced whole; frozen by the first Application."""

    minimum_total_experience_years: float | None = Field(
        default=None,
        ge=0,
        le=MAX_YEARS_EXPERIENCE,
        description="Total years of work an applicant needs. Null asks for none.",
    )
    skills: list[JobSkillRequirement] = _section("Canonical skills the role asks for.")
    languages: list[JobLanguageRequirement] = _section("Languages the role asks for.")
    questions: list[JobQuestion] = _section("Questions, in the order applicants answer them.")

    @model_validator(mode="after")
    def _one_entry_per_skill_and_language(self) -> JobCriteria:
        # Caught here rather than by the unique constraints, which would refuse the save half
        # way through with a message about an index.
        _refuse_repeats([skill.name for skill in self.skills], "skill")
        _refuse_repeats([language.code for language in self.languages], "language")
        return self


class JobCriteriaView(BaseModel):
    """The stored criteria. A `GET` body is a valid `PUT` body; the question ids are ignored."""

    minimum_total_experience_years: float | None = None
    skills: list[JobSkillRequirement]
    languages: list[JobLanguageRequirement]
    questions: list[JobQuestionView]


class NewJob(BaseModel):
    """A Job as it is first written. It starts as a draft, with no criteria."""

    title: Line = Field(examples=["Senior Backend Engineer"])
    description: Paragraph
    location_key: LocationKey = None
    employment_type: EmploymentTypeChoice = None
    work_mode: WorkModeChoice = None
    expires_at: Expiry = None


class JobChanges(BaseModel):
    """What a Recruiter may still change. Omitted fields stay as they are."""

    title: Line | None = None
    description: Paragraph | None = None
    location_key: LocationKey = None
    employment_type: EmploymentTypeChoice = None
    work_mode: WorkModeChoice = None
    expires_at: Expiry = None
    status: JobStatus | None = Field(
        default=None,
        description="Where the Job goes next: `draft` → `published` ⇄ `closed`, "
        "and `archived` from anywhere.",
    )

    @model_validator(mode="after")
    def _what_a_job_cannot_do_without(self) -> JobChanges:
        _refuse_blanks(self, "title", "description", "status")
        return self


class JobSummary(BaseModel):
    """One of the tenant's Jobs, as its own list renders it."""

    id: UUID
    title: str
    status: JobStatus
    location_key: str | None = None
    location_name: LocationName = None
    employment_type: EmploymentType | None = None
    work_mode: WorkMode | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = Field(
        default=None,
        description="When the Job first went live. Null while it has never been published, and "
        "unchanged by a later republish.",
    )
    application_count: int = Field(description="How many Applications this Job has received.")
    view_count: int = Field(
        description="How many times this Job's page has been read, through a Tracked link or "
        "not. One browser reading it repeatedly counts once per half hour, per channel."
    )


class JobView(JobSummary):
    """A Job as its own Recruiters see it, criteria and all."""

    description: str
    criteria: JobCriteriaView
    criteria_locked: bool = Field(
        description="True once the Job has an Application: the criteria are frozen from then on, "
        "and only the prose can still be edited."
    )


class JobSort(StrEnum):
    """The orders the tenant's own Jobs list can be read in."""

    NEWEST = "newest"
    OLDEST = "oldest"
    APPLICATIONS = "applications"


class JobPage(BaseModel):
    """One page of the tenant's Jobs, in the order that was asked for."""

    items: list[JobSummary]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )


class PublicTenant(BaseModel):
    """The Tenant a published Job belongs to. Never more of it than a job board shows."""

    name: str
    slug: str


class PublicJobSummary(BaseModel):
    """One published Job, as the public list renders it."""

    id: UUID
    title: str
    tenant: PublicTenant
    location_key: str | None = None
    location_name: LocationName = None
    employment_type: EmploymentType | None = None
    work_mode: WorkMode | None = None
    expires_at: datetime | None = None
    created_at: datetime


class PublicJob(PublicJobSummary):
    """A published Job as a visitor reads it, with everything applying to it will ask for."""

    description: str
    minimum_total_experience_years: float | None = None
    skills: list[JobSkillRequirement]
    languages: list[JobLanguageRequirement]
    questions: list[PublicJobQuestion]


class PublicJobPage(BaseModel):
    """One page of published Jobs, newest first."""

    items: list[PublicJobSummary]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )


class NewTrackedLink(BaseModel):
    """A named link to a Job, so the views and applications it brings can be told apart."""

    name: Line = Field(description="What the campaign is called, unique per Job.")
    expires_at: Expiry = None


class TrackedLinkChanges(BaseModel):
    """What a Recruiter may change about a link. Omitted fields stay as they are."""

    name: Line | None = None
    is_active: bool | None = None
    expires_at: Expiry = None

    @model_validator(mode="after")
    def _what_a_link_cannot_do_without(self) -> TrackedLinkChanges:
        _refuse_blanks(self, "name", "is_active")
        return self


class TrackedLink(BaseModel):
    """One campaign link, and how much traffic it has brought."""

    id: UUID
    name: str
    token: str = Field(description="The unguessable part of the public URL.")
    is_active: bool
    expires_at: datetime | None = None
    created_at: datetime
    view_count: int = Field(description="Job views that arrived through this link.")


class LinkedJob(BaseModel):
    """The Job a Tracked link points at, as a list spanning every Job has to name it."""

    id: UUID
    title: str


class TenantTrackedLink(TrackedLink):
    """One Tracked link in the tenant's own list of them.

    One row per link, never merged by name: a link has a state and a Job of its own, and the
    same name on two Jobs is two links with two of each. The Dashboard's `sources` merges by
    name instead, because it answers a different question — which channel works, not how each
    link is doing.
    """

    job: LinkedJob


class TenantTrackedLinkPage(BaseModel):
    """One page of the tenant's Tracked links, newest first across every Job."""

    items: list[TenantTrackedLink]
    next_cursor: str | None = Field(
        default=None, description="Send back as `cursor` for the following page."
    )


def _refuse_blanks(model: BaseModel, *fields: str) -> None:
    """A `PATCH` omits what it does not change; an explicit null on these would empty a column
    the database will not have empty."""
    blanked = [
        field
        for field in fields
        if field in model.model_fields_set and getattr(model, field) is None
    ]
    if blanked:
        raise ValueError(f"{', '.join(blanked)} cannot be null")


def _refuse_repeats(names: list[str], singular: str) -> None:
    repeated = sorted({name for name in names if names.count(name) > 1})
    if repeated:
        raise ValueError(f"one entry per {singular}; repeated: {', '.join(repeated)}")
