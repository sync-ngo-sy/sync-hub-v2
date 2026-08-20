"""What the platform means by a complete profile, and why an import may not be one.

Mirrored from `sync_core.completeness` rather than imported, on the same terms as `links`: this
script stays standalone. The rule is not a style choice here — `candidates` enforces it in the
row itself, so a marker written over a profile that has not earned it is refused by the database
rather than merely being wrong:

    candidates_completed_profile_is_filled_in
    candidates_searchable_needs_a_complete_profile
    candidates_searchable_needs_cv

So the migration has to be able to say, per candidate, exactly which of the ten facts is missing
— both to avoid writing a marker that would fail, and to tell the operator why somebody who was
migrated is not yet findable.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class Requirement(StrEnum):
    """The ten facts a complete profile holds. The values are the platform's own."""

    CV = "cv"
    FULL_NAME = "full_name"
    PHONE = "phone"
    HEADLINE = "headline"
    LOCATION = "location"
    CANONICAL_ROLE = "canonical_role"
    SUMMARY = "summary"
    EDUCATION = "education"
    SKILL = "skill"
    LANGUAGE = "language"


#: What each missing requirement means to somebody who did not write the schema. The migration
#: reports these, so an operator reading "37 people are not searchable" can see why.
IN_PLAIN_WORDS: Final[dict[Requirement, str]] = {
    Requirement.CV: "no CV that the parser could read",
    Requirement.FULL_NAME: "no name",
    Requirement.PHONE: "no usable phone number",
    Requirement.HEADLINE: "no job title",
    Requirement.LOCATION: "no location we recognise",
    Requirement.CANONICAL_ROLE: "no role we could match to our list",
    Requirement.SUMMARY: "no profile summary",
    Requirement.EDUCATION: "no education history",
    Requirement.SKILL: "no skill we could match to our list",
    Requirement.LANGUAGE: "no languages",
}


@dataclass(frozen=True, slots=True)
class ProfileFacts:
    """The state of one candidate's profile, as the database holds it after a publish."""

    has_a_read_cv: bool = False
    full_name: str | None = None
    phone: str | None = None
    phone_country: str | None = None
    headline: str | None = None
    summary: str | None = None
    location_key: str | None = None
    canonical_role_key: str | None = None
    educations: int = 0
    skills: int = 0
    languages: int = 0


def _said(value: str | None) -> bool:
    return value is not None and value.strip() != ""


def missing_requirements(facts: ProfileFacts) -> tuple[Requirement, ...]:
    """Which of the ten this profile does not hold, in the platform's own order."""
    met = {
        Requirement.CV: facts.has_a_read_cv,
        Requirement.FULL_NAME: _said(facts.full_name),
        Requirement.PHONE: _said(facts.phone) and _said(facts.phone_country),
        Requirement.HEADLINE: _said(facts.headline),
        Requirement.LOCATION: _said(facts.location_key),
        Requirement.CANONICAL_ROLE: _said(facts.canonical_role_key),
        Requirement.SUMMARY: _said(facts.summary),
        Requirement.EDUCATION: facts.educations > 0,
        Requirement.SKILL: facts.skills > 0,
        Requirement.LANGUAGE: facts.languages > 0,
    }
    return tuple(requirement for requirement, held in met.items() if not held)


def completion_percent(missing: tuple[Requirement, ...]) -> int:
    total = len(Requirement)
    met = total - len(missing)
    return (met * 100 + total // 2) // total


def why_not_complete(missing: tuple[Requirement, ...]) -> str:
    """The missing requirements as a sentence an operator can act on."""
    if not missing:
        return "complete"
    return ", ".join(IN_PLAIN_WORDS[requirement] for requirement in missing)
