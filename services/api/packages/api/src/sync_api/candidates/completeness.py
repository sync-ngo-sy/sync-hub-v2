from __future__ import annotations

from typing import Final

from sync_core.completeness import Requirement

PHRASES: Final[dict[Requirement, str]] = {
    Requirement.CV: "a CV that has been read",
    Requirement.FULL_NAME: "your name",
    Requirement.PHONE: "a phone number and the country it belongs to",
    Requirement.HEADLINE: "a headline",
    Requirement.LOCATION: "where you are",
    Requirement.CANONICAL_ROLE: "what kind of work you do",
    Requirement.SUMMARY: "a summary",
    Requirement.EXPERIENCE: "at least one job",
    Requirement.EDUCATION: "at least one qualification",
    Requirement.SKILL: "at least one skill",
    Requirement.LANGUAGE: "at least one language",
}


def named(missing: tuple[Requirement, ...]) -> str:
    phrases = [PHRASES[requirement] for requirement in missing]
    if len(phrases) <= 1:
        return "".join(phrases)
    return f"{', '.join(phrases[:-1])} and {phrases[-1]}"
