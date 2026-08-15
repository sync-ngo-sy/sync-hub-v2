from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import ColumnElement, func, select

from sync_core.models import (
    Candidate,
    CandidateEducation,
    CandidateExperience,
    CandidateLanguage,
    CandidateSkill,
    Cv,
    CvParsingStatus,
    Profile,
)

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession


class Requirement(StrEnum):
    """One thing a Complete profile has, in the order the editor asks for it.

    Projects, Other skills and Links are deliberately not here: they are worth having, and
    nobody is held back from applying for not having them.
    """

    CV = "cv"
    FULL_NAME = "full_name"
    PHONE = "phone"
    HEADLINE = "headline"
    LOCATION = "location"
    CANONICAL_ROLE = "canonical_role"
    SUMMARY = "summary"
    EXPERIENCE = "experience"
    EDUCATION = "education"
    SKILL = "skill"
    LANGUAGE = "language"


@dataclass(frozen=True, slots=True)
class ProfileFacts:
    """What the rule reads, and nothing else — so a profile, a draft of one and a form part way
    through being typed can all be measured by the same function."""

    has_a_read_cv: bool = False
    full_name: str | None = None
    phone: str | None = None
    phone_country: str | None = None
    headline: str | None = None
    summary: str | None = None
    location_key: str | None = None
    canonical_role_key: str | None = None
    experiences: int = 0
    educations: int = 0
    skills: int = 0
    languages: int = 0


def _said(value: str | None) -> bool:
    return value is not None and value.strip() != ""


def missing_requirements(facts: ProfileFacts) -> tuple[Requirement, ...]:
    """Every requirement the profile has not met, in `Requirement` order.

    A Phone is present when both halves of it are: the number on its own names no country, and
    a country on its own is nothing to dial. That the number is one that country can *dial* is
    held where it is stored — the payload refuses it, and so does a CHECK.
    """
    met = {
        Requirement.CV: facts.has_a_read_cv,
        Requirement.FULL_NAME: _said(facts.full_name),
        Requirement.PHONE: _said(facts.phone) and _said(facts.phone_country),
        Requirement.HEADLINE: _said(facts.headline),
        Requirement.LOCATION: _said(facts.location_key),
        Requirement.CANONICAL_ROLE: _said(facts.canonical_role_key),
        Requirement.SUMMARY: _said(facts.summary),
        Requirement.EXPERIENCE: facts.experiences > 0,
        Requirement.EDUCATION: facts.educations > 0,
        Requirement.SKILL: facts.skills > 0,
        Requirement.LANGUAGE: facts.languages > 0,
    }
    return tuple(requirement for requirement, held in met.items() if not held)


def completion_percent(missing: tuple[Requirement, ...]) -> int:
    """How far along the profile is, as a whole percent.

    Integer arithmetic, rounding halves up, because the browser states this rule too and the two
    have to answer the same number — and `round()` and `Math.round()` do not agree on a half.
    """
    total = len(Requirement)
    met = total - len(missing)
    return (met * 100 + total // 2) // total


type _Section = (
    type[CandidateExperience]
    | type[CandidateEducation]
    | type[CandidateSkill]
    | type[CandidateLanguage]
)


def _counted(section: _Section, candidate_id: UUID) -> ColumnElement[int]:
    return (
        select(func.count())
        .select_from(section)
        .where(section.candidate_id == candidate_id)
        .scalar_subquery()
    )


async def profile_facts(session: AsyncSession, candidate_id: UUID) -> ProfileFacts:
    """The saved profile, as the rule reads it: one statement across the six tables it spans."""
    row = (
        await session.execute(
            select(
                Profile.full_name,
                Profile.phone,
                Profile.phone_country,
                Candidate.headline,
                Candidate.summary,
                Candidate.location_key,
                Candidate.canonical_role_key,
                select(Cv.id)
                .where(
                    Cv.id == Candidate.current_cv_id,
                    Cv.candidate_id == Candidate.id,
                    Cv.parsing_status == CvParsingStatus.READY,
                    Cv.deleted_at.is_(None),
                )
                .exists()
                .label("has_a_read_cv"),
                _counted(CandidateExperience, candidate_id).label("experiences"),
                _counted(CandidateEducation, candidate_id).label("educations"),
                _counted(CandidateSkill, candidate_id).label("skills"),
                _counted(CandidateLanguage, candidate_id).label("languages"),
            )
            .join(Profile, Profile.id == Candidate.id)
            .where(Candidate.id == candidate_id)
        )
    ).one()

    return ProfileFacts(
        has_a_read_cv=row.has_a_read_cv,
        full_name=row.full_name,
        phone=row.phone,
        phone_country=row.phone_country,
        headline=row.headline,
        summary=row.summary,
        location_key=row.location_key,
        canonical_role_key=row.canonical_role_key,
        experiences=row.experiences,
        educations=row.educations,
        skills=row.skills,
        languages=row.languages,
    )


async def refresh_completeness(
    session: AsyncSession, candidate_id: UUID
) -> tuple[Requirement, ...]:
    """Bring `profile_completed_at` up to date with the profile as it now stands, and say what is
    still missing. The caller's transaction owns the commit, so the marker lands with the save
    that earned it rather than after it.

    The row is written only when the answer changes: any update of it enqueues a re-embedding of
    the whole profile, and "when it became Complete" is not a timestamp to move on every save.
    """
    missing = missing_requirements(await profile_facts(session, candidate_id))
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:  # pragma: no cover — every caller holds this row
        raise LookupError(f"no candidate row for {candidate_id}")

    if missing and candidate.profile_completed_at is not None:
        candidate.profile_completed_at = None
    elif not missing and candidate.profile_completed_at is None:
        candidate.profile_completed_at = datetime.now(UTC)
    return missing
