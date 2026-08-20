from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final, cast

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from uuid import UUID

MAX_ENTRIES: Final = 50
MAX_LINE: Final = 200
UNSTATED_YEARS: Final = 0.0
YEAR_RANGE: Final = range(1900, 2101)
MONTH_RANGE: Final = range(1, 13)


@dataclass(frozen=True, slots=True)
class ParsedProfile:
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
        return bool(self.experiences or self.educations or self.skills or self.projects)


@dataclass(frozen=True, slots=True)
class FromManatal:
    position: str | None = None
    company: str | None = None
    degree: str | None = None
    university: str | None = None
    graduation_year: int | None = None
    english: str | None = None

    def experiences(self, candidate_id: UUID) -> list[tuple[Any, ...]]:
        if not (self.position or self.company):
            return []
        return [
            (
                candidate_id,
                0,
                (self.position or "Not stated")[:200],
                (self.company or None) and self.company[:200],
                None,
                None,
                None,
                None,
                True,
                None,
            )
        ]

    def educations(self, candidate_id: UUID) -> list[tuple[Any, ...]]:
        if not (self.degree or self.university or self.graduation_year):
            return []
        return [
            (
                candidate_id,
                0,
                (self.university or "Not stated")[:200],
                (self.degree or None) and self.degree[:200],
                None,
                self.graduation_year,
                None,
            )
        ]

    def languages(self, candidate_id: UUID) -> list[tuple[Any, ...]]:
        if not self.english:
            return []
        return [(candidate_id, 0, "en", self.english)]


NOTHING_FROM_MANATAL: Final = FromManatal()


def profile_from(
    parsed: Mapping[str, Any],
    *,
    candidate_id: UUID,
    taxonomy: Mapping[str, UUID],
    languages: Sequence[str],
) -> ParsedProfile:
    known_languages = {code.lower() for code in languages}
    return ParsedProfile(
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


def linkedin_from_parse(parsed: Mapping[str, Any] | None) -> str | None:
    if not parsed:
        return None
    from sync_manatal.links import linkedin_address

    stated = parsed.get("linkedin_url")
    return linkedin_address(stated) if isinstance(stated, str) else None


def _entries(parsed: Mapping[str, Any], key: str) -> list[Mapping[str, Any]]:
    kept = [entry for entry in _list(parsed.get(key)) if isinstance(entry, dict)]
    return cast("list[Mapping[str, Any]]", kept[:MAX_ENTRIES])


def _named_skills(
    parsed: Mapping[str, Any], taxonomy: Mapping[str, UUID]
) -> list[Mapping[str, Any]]:
    seen: set[str] = set()
    kept: list[Mapping[str, Any]] = []
    for entry in _entries(parsed, "skills"):
        key = _key(entry.get("name"))
        if key in taxonomy and key not in seen:
            seen.add(key)
            kept.append(entry)
    return kept


def _spoken(parsed: Mapping[str, Any], known: set[str]) -> list[Mapping[str, Any]]:
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
    stated = str(value).strip() if isinstance(value, str) else ""
    return stated or None


def _year(value: object) -> int | None:
    return int(value) if isinstance(value, int) and value in YEAR_RANGE else None


def _month(value: object) -> int | None:
    return int(value) if isinstance(value, int) and value in MONTH_RANGE else None
