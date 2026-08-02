from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from decimal import Decimal

    from sync_assessments.schema import AssessedMatch
    from sync_core.models import EmploymentType, LanguageProficiency, SkillImportance


@dataclass(frozen=True, slots=True)
class RequiredSkill:
    """One Canonical skill the Job asks for, and how much of it."""

    name: str
    importance: SkillImportance
    minimum_years: int | None = None


@dataclass(frozen=True, slots=True)
class RequiredLanguage:
    """One language the Job asks for, and how well."""

    name: str
    minimum_proficiency: LanguageProficiency


@dataclass(frozen=True, slots=True)
class AssessedJob:
    """The Job, as the bar an Application is read against."""

    title: str
    description: str
    location: str | None = None
    employment_type: EmploymentType | None = None
    minimum_total_experience_years: Decimal | None = None
    skills: tuple[RequiredSkill, ...] = ()
    languages: tuple[RequiredLanguage, ...] = ()


@dataclass(frozen=True, slots=True)
class HeldExperience:
    job_title: str
    company_name: str | None = None
    start_year: int | None = None
    start_month: int | None = None
    end_year: int | None = None
    end_month: int | None = None
    is_current: bool = False
    description: str | None = None


@dataclass(frozen=True, slots=True)
class HeldEducation:
    institution: str
    degree: str | None = None
    field_of_study: str | None = None
    graduation_year: int | None = None


@dataclass(frozen=True, slots=True)
class HeldSkill:
    name: str
    years_experience: Decimal | None = None


@dataclass(frozen=True, slots=True)
class SpokenLanguage:
    name: str
    proficiency: LanguageProficiency


@dataclass(frozen=True, slots=True)
class BuiltProject:
    name: str
    description: str | None = None


@dataclass(frozen=True, slots=True)
class AskedQuestion:
    """One question the Job asked, and the answer the Application gave it."""

    question: str
    answer: str


@dataclass(frozen=True, slots=True)
class AssessedApplication:
    """What the Application froze when it was sent — never the Candidate's live profile.

    Their name, phone and email are deliberately absent: nothing an assessment could weigh
    is in them, and an identity the model can guess a background from is one it can be
    biased by.
    """

    headline: str | None = None
    summary: str | None = None
    location: str | None = None
    experiences: tuple[HeldExperience, ...] = ()
    educations: tuple[HeldEducation, ...] = ()
    skills: tuple[HeldSkill, ...] = ()
    languages: tuple[SpokenLanguage, ...] = ()
    projects: tuple[BuiltProject, ...] = ()
    answers: tuple[AskedQuestion, ...] = ()


@dataclass(frozen=True, slots=True)
class MatchRequest:
    """The whole input to one assessment: the Job's criteria, and the Snapshot answering it."""

    job: AssessedJob
    application: AssessedApplication


class AssessmentError(Exception):
    """The assessment did not happen. Nothing was written, and asking again is reasonable."""


class MatchAssessor(Protocol):
    @property
    def model(self) -> str: ...

    async def assess(self, request: MatchRequest) -> AssessedMatch: ...
