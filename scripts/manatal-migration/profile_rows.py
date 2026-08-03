"""Turning a CV the platform has already parsed into the profile rows a Candidate is made of.

Pure: dictionaries in, rows out, no database and no network — which is what makes it the part
worth testing hardest. The shapes it produces are the platform's own `candidate_*` tables.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from uuid import UUID

#: The platform caps a profile's sections at this, and a migrated profile is not special.
MAX_ENTRIES: Final = 50

MAX_LINE: Final = 200

#: `candidate_skills.years_experience` is not nullable, and a CV that evidences a skill without
#: saying for how long leaves nothing to write. Zero is what stands there until somebody who knows
#: types a real figure.
UNSTATED_YEARS: Final = 0.0

YEAR_RANGE: Final = range(1900, 2101)
MONTH_RANGE: Final = range(1, 13)


@dataclass(frozen=True, slots=True)
class Profile:
    """Everything one publish writes, ready to be handed to the database as-is."""

    headline: str | None
    summary: str | None
    unmapped_skills: list[str]
    experiences: list[tuple[Any, ...]] = field(default_factory=list)
    educations: list[tuple[Any, ...]] = field(default_factory=list)
    skills: list[tuple[Any, ...]] = field(default_factory=list)
    languages: list[tuple[Any, ...]] = field(default_factory=list)
    projects: list[tuple[Any, ...]] = field(default_factory=list)

    @property
    def is_worth_publishing(self) -> bool:
        """A profile with nothing in it would be a search result with nothing to match. The
        headline and summary alone are not enough to be worth being found on."""
        return bool(self.experiences or self.educations or self.skills or self.projects)


def profile_from(
    parsed: Mapping[str, Any],
    *,
    candidate_id: UUID,
    taxonomy: Mapping[str, UUID],
    languages: Sequence[str],
) -> Profile:
    """The rows this parse becomes.

    `taxonomy` and `languages` are the platform's own vocabularies, read live. A skill or language
    the parse names that is not in them is dropped rather than invented — the parse was produced
    against those same lists, so a miss means the taxonomy moved underneath it.
    """
    known_languages = {code.lower() for code in languages}
    return Profile(
        headline=_line(parsed.get("headline")) or None,
        summary=_text(parsed.get("summary")),
        unmapped_skills=[
            line
            for line in (_line(entry) for entry in _list(parsed.get("unmapped_skills")))
            if line
        ][:MAX_ENTRIES],
        experiences=[
            (
                candidate_id,
                order,
                _line(entry.get("job_title")) or "Not stated",
                _line(entry.get("company_name")),
                _year(entry.get("start_year")),
                _month(entry.get("start_month")),
                None if entry.get("is_current") else _year(entry.get("end_year")),
                None if entry.get("is_current") else _month(entry.get("end_month")),
                bool(entry.get("is_current")),
                _text(entry.get("description")),
            )
            for order, entry in enumerate(_entries(parsed, "experiences"))
        ],
        educations=[
            (
                candidate_id,
                order,
                _line(entry.get("institution")) or "Not stated",
                _line(entry.get("degree")),
                _line(entry.get("field_of_study")),
                _year(entry.get("graduation_year")),
                _text(entry.get("description")),
            )
            for order, entry in enumerate(_entries(parsed, "educations"))
        ],
        skills=[
            (candidate_id, order, taxonomy[_key(entry.get("name"))], _years(entry))
            for order, entry in enumerate(_named_skills(parsed, taxonomy))
        ],
        languages=[
            (candidate_id, order, _key(entry.get("code")), _line(entry.get("proficiency")))
            for order, entry in enumerate(_spoken(parsed, known_languages))
        ],
        projects=[
            (
                candidate_id,
                order,
                _line(entry.get("name")) or "Not stated",
                _text(entry.get("description")),
                _line(entry.get("project_url")),
                _line(entry.get("repository_url")),
                _year(entry.get("start_year")),
                _month(entry.get("start_month")),
                _year(entry.get("end_year")),
                _month(entry.get("end_month")),
            )
            for order, entry in enumerate(_entries(parsed, "projects"))
        ],
    )


def _entries(parsed: Mapping[str, Any], key: str) -> list[Mapping[str, Any]]:
    return [entry for entry in _list(parsed.get(key)) if isinstance(entry, dict)][:MAX_ENTRIES]


def _named_skills(
    parsed: Mapping[str, Any], taxonomy: Mapping[str, UUID]
) -> list[Mapping[str, Any]]:
    """`candidate_skills` is keyed by (candidate, taxonomy), so a name the parse repeats has to be
    dropped rather than left to fail the whole insert."""
    seen: set[str] = set()
    kept: list[Mapping[str, Any]] = []
    for entry in _entries(parsed, "skills"):
        key = _key(entry.get("name"))
        if key in taxonomy and key not in seen:
            seen.add(key)
            kept.append(entry)
    return kept


def _spoken(parsed: Mapping[str, Any], known: set[str]) -> list[Mapping[str, Any]]:
    """Same again for `candidate_languages`, keyed by (candidate, language code)."""
    seen: set[str] = set()
    kept: list[Mapping[str, Any]] = []
    for entry in _entries(parsed, "languages"):
        code = _key(entry.get("code"))
        if code in known and code not in seen and _line(entry.get("proficiency")):
            seen.add(code)
            kept.append(entry)
    return kept


def _years(entry: Mapping[str, Any]) -> float:
    stated = entry.get("years_experience")
    if isinstance(stated, int | float) and 0 <= float(stated) <= 999.9:
        return round(float(stated), 1)
    return UNSTATED_YEARS


def _list(value: object) -> list[Any]:
    return value if isinstance(value, list) else []


def _key(value: object) -> str:
    return _line(value).lower()


def _line(value: object) -> str:
    return str(value).strip()[:MAX_LINE] if isinstance(value, str) else ""


def _text(value: object) -> str | None:
    """A paragraph, or nothing. Empty strings are how "not stated" arrives, and the platform
    stores that as null."""
    stated = str(value).strip() if isinstance(value, str) else ""
    return stated or None


def _year(value: object) -> int | None:
    return int(value) if isinstance(value, int) and value in YEAR_RANGE else None


def _month(value: object) -> int | None:
    return int(value) if isinstance(value, int) and value in MONTH_RANGE else None
