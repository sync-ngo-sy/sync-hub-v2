from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from sync_core import get_logger
from sync_core.links import github_address, linkedin_address, portfolio_address
from sync_core.profile import (
    CONTROL_CHARACTERS,
    EARLIEST_YEAR,
    LATEST_YEAR,
    MAX_ENTRIES,
    MAX_LINE_LENGTH,
    MAX_LINK_LENGTH,
    MAX_PARAGRAPH_LENGTH,
    MAX_YEARS_EXPERIENCE,
    YEARS_EXPERIENCE_DECIMALS,
)
from sync_parsers import (
    ParsedCv,
    ParsedEducation,
    ParsedExperience,
    ParsedLanguage,
    ParsedProject,
    ParsedSkill,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Mapping, Sequence

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Vocabularies:
    """Every closed list a parse is held to, each keyed by its own lowercased spelling.

    A model asked for a key from a list will occasionally answer with one that is nearly it;
    everything the platform stores by key is matched back here rather than trusted.
    """

    taxonomy: Mapping[str, str]
    roles: Mapping[str, str]
    languages: Mapping[str, str]


def reviewable(parsed: ParsedCv, known: Vocabularies) -> ParsedCv:
    skills, demoted = _skills(parsed.skills, known.taxonomy)
    reviewed = ParsedCv(
        full_name=_line(parsed.full_name),
        email=_line(parsed.email),
        phone=_line(parsed.phone),
        detected_language=_known_code(parsed.detected_language, known.languages),
        canonical_role=_role(parsed.canonical_role, known.roles),
        headline=_line(parsed.headline),
        summary=_paragraph(parsed.summary),
        location=_line(parsed.location),
        linkedin_url=_address(linkedin_address, parsed.linkedin_url, field="linkedin_url"),
        github_url=_address(github_address, parsed.github_url, field="github_url"),
        portfolio_url=_address(portfolio_address, parsed.portfolio_url, field="portfolio_url"),
        experiences=_experiences(parsed.experiences),
        educations=_educations(parsed.educations),
        skills=skills,
        languages=_languages(parsed.languages, known.languages),
        projects=_projects(parsed.projects),
        unmapped_skills=_unmapped([*parsed.unmapped_skills, *demoted]),
    )
    _report_discards(parsed, reviewed)
    return reviewed


def _report_discards(parsed: ParsedCv, reviewed: ParsedCv) -> None:
    lost = {
        section: before - after
        for section, before, after in (
            ("experiences", len(parsed.experiences), len(reviewed.experiences)),
            ("educations", len(parsed.educations), len(reviewed.educations)),
            ("projects", len(parsed.projects), len(reviewed.projects)),
            ("languages", len(parsed.languages), len(reviewed.languages)),
        )
        if before > after
    }
    if lost:
        logger.info("cv_review.entries_discarded", **lost)


def _skills(
    skills: Sequence[ParsedSkill], taxonomy: Mapping[str, str]
) -> tuple[list[ParsedSkill], list[str]]:
    canonical: dict[str, ParsedSkill] = {}
    demoted: list[str] = []
    for skill in skills:
        name = (skill.name or "").strip()
        known = taxonomy.get(name.lower())
        if known is None:
            if name:
                demoted.append(name)
            continue
        canonical.setdefault(
            known, ParsedSkill(name=known, years_experience=_years(skill.years_experience))
        )
    return list(canonical.values())[:MAX_ENTRIES], demoted


def _role(key: str | None, known: Mapping[str, str]) -> str | None:
    """The proposed Canonical role, or nothing: a key the taxonomy does not have is dropped
    rather than shown to the candidate as a choice they cannot save."""
    return known.get((key or "").strip().lower())


def _languages(
    languages: Sequence[ParsedLanguage], known: Mapping[str, str]
) -> list[ParsedLanguage]:
    kept: dict[str, ParsedLanguage] = {}
    for language in languages:
        code = known.get((language.code or "").strip().lower())
        if code is not None:
            kept.setdefault(code, ParsedLanguage(code=code, proficiency=language.proficiency))
    return list(kept.values())[:MAX_ENTRIES]


def _experiences(experiences: Sequence[ParsedExperience]) -> list[ParsedExperience]:
    kept = []
    for entry in experiences:
        title = _line(entry.job_title)
        if title is None:
            continue
        start_year, start_month, end_year, end_month = _period(entry)
        current = entry.is_current and end_year is None and end_month is None
        kept.append(
            ParsedExperience(
                job_title=title,
                company_name=_line(entry.company_name),
                start_year=start_year,
                start_month=start_month,
                end_year=end_year,
                end_month=end_month,
                is_current=current,
                description=_paragraph(entry.description),
            )
        )
    return kept[:MAX_ENTRIES]


def _educations(educations: Sequence[ParsedEducation]) -> list[ParsedEducation]:
    kept = []
    for entry in educations:
        institution = _line(entry.institution)
        if institution is None:
            continue
        kept.append(
            ParsedEducation(
                institution=institution,
                degree=_line(entry.degree),
                field_of_study=_line(entry.field_of_study),
                graduation_year=_year(entry.graduation_year),
                description=_paragraph(entry.description),
            )
        )
    return kept[:MAX_ENTRIES]


def _projects(projects: Sequence[ParsedProject]) -> list[ParsedProject]:
    kept = []
    for entry in projects:
        name = _line(entry.name)
        if name is None:
            continue
        start_year, start_month, end_year, end_month = _period(entry)
        kept.append(
            ParsedProject(
                name=name,
                description=_paragraph(entry.description),
                project_url=_link(entry.project_url),
                repository_url=_link(entry.repository_url),
                start_year=start_year,
                start_month=start_month,
                end_year=end_year,
                end_month=end_month,
            )
        )
    return kept[:MAX_ENTRIES]


def _period(
    entry: ParsedExperience | ParsedProject,
) -> tuple[int | None, int | None, int | None, int | None]:
    start_year, start_month = _year(entry.start_year), _month(entry.start_month)
    end_year, end_month = _year(entry.end_year), _month(entry.end_month)
    if start_year is not None and end_year is not None:
        if (end_year, end_month or 12) < (start_year, start_month or 1):
            end_year, end_month = None, None
    elif end_year is None:
        end_month = None
    return start_year, start_month, end_year, end_month


def _unmapped(names: Iterable[str]) -> list[str]:
    seen: dict[str, str] = {}
    for name in names:
        trimmed = _line(name)
        if trimmed is not None:
            seen.setdefault(trimmed.lower(), trimmed)
    return list(seen.values())[:MAX_ENTRIES]


def _address(normalize: Callable[[str], str], value: str | None, *, field: str) -> str | None:
    """One profile Link, in the single form the profile stores it in.

    Dropped rather than kept where the text is not that kind of address at all: a CV's footer
    puts every link on one line, and a GitHub read into the LinkedIn field would be shown to the
    candidate as their own answer to a question they never answered.
    """
    text = _link(value)
    if text is None:
        return None
    try:
        return normalize(text)
    except ValueError:
        logger.info("cv_review.link_discarded", field=field)
        return None


def _line(value: str | None) -> str | None:
    return _text(value, MAX_LINE_LENGTH)


def _paragraph(value: str | None) -> str | None:
    return _text(value, MAX_PARAGRAPH_LENGTH)


def _link(value: str | None) -> str | None:
    return _text(value, MAX_LINK_LENGTH)


def _text(value: str | None, limit: int) -> str | None:
    """A control character becomes a space rather than taking the value with it: nobody is waiting
    to retype what the pipeline read, and a page break inside a summary is not a reason to lose the
    summary. Tab, newline and carriage return stay: they are how a CV is laid out."""
    if value is None:
        return None
    trimmed = CONTROL_CHARACTERS.sub(" ", value).strip()[:limit].strip()
    return trimmed or None


def _known_code(value: str | None, known: Mapping[str, str]) -> str | None:
    return known.get((value or "").strip().lower())


def _year(value: int | None) -> int | None:
    return value if value is not None and EARLIEST_YEAR <= value <= LATEST_YEAR else None


def _month(value: int | None) -> int | None:
    return value if value is not None and 1 <= value <= 12 else None


def _years(value: float | None) -> float | None:
    if value is None or value < 0:
        return None
    return round(min(value, MAX_YEARS_EXPERIENCE), YEARS_EXPERIENCE_DECIMALS)
