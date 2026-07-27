"""Turning what the model answered into what the candidate reviews.

Two jobs, and they are the same job seen from two sides.

**Skills are checked against the taxonomy.** ADR-0006 has the mapping happen in-model — the
prompt lists every Canonical skill and asks for those names — but a prompt is a request,
not a guarantee. So every name that comes back is looked up, and anything that is not a
Canonical skill is moved into `unmapped_skills`, where the candidate sees it and Screening
never does. That is the whole difference between a skill that can disqualify an application
and a word the AI liked.

**Everything else is coerced to the limits a profile has.** The review screen posts what it
is given to `PUT /v1/candidates/me/profile`, so a parse carrying a year the profile refuses
is a parse the candidate cannot accept without hand-editing a field they never wrote. The
limits are `sync_core.profile`'s, which is where the profile payload gets them too.

Nothing here is a refusal. A hallucinated year costs its own field and nothing else: the
CV is still parsed, the candidate still reviews it, and the one value the model invented
is simply not there.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sync_core.profile import (
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
    from collections.abc import Iterable, Mapping, Sequence


def reviewable(
    parsed: ParsedCv, *, taxonomy: Mapping[str, str], languages: Mapping[str, str]
) -> ParsedCv:
    """The parse as it will be stored, reviewed, and posted back.

    `taxonomy` and `languages` are keyed by the lowercased name for the lookup and hold the
    platform's own spelling as the value — matching case-insensitively and then answering in
    the canonical spelling, because "python" is the candidate's skill under a different
    shift key, not an unmapped one.
    """
    skills, demoted = _skills(parsed.skills, taxonomy)
    return ParsedCv(
        full_name=_line(parsed.full_name),
        email=_line(parsed.email),
        phone=_line(parsed.phone),
        detected_language=_code(parsed.detected_language),
        headline=_line(parsed.headline),
        summary=_paragraph(parsed.summary),
        location=_line(parsed.location),
        experiences=_experiences(parsed.experiences),
        educations=_educations(parsed.educations),
        skills=skills,
        languages=_languages(parsed.languages, languages),
        projects=_projects(parsed.projects),
        unmapped_skills=_unmapped(list(parsed.unmapped_skills) + demoted),
    )


def _skills(
    skills: Sequence[ParsedSkill], taxonomy: Mapping[str, str]
) -> tuple[list[ParsedSkill], list[str]]:
    """The Canonical ones, in the taxonomy's spelling; and the names that were not.

    One entry per skill, first mention winning, because `candidate_skills` is keyed by
    `(candidate_id, taxonomy_id)` — a repeat is the CV listing something twice, not two
    different skills, and it would fail the profile save.
    """
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


def _languages(
    languages: Sequence[ParsedLanguage], known: Mapping[str, str]
) -> list[ParsedLanguage]:
    """The ones the platform has a code for, deduplicated.

    A language the `languages` table does not list is dropped rather than surfaced: unlike
    a skill there is nowhere to surface it to, and keeping it would make the parse fail the
    profile save it exists to feed.
    """
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
            continue  # `candidate_experiences.job_title` is NOT NULL; there is no job here
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


def _period(entry: ParsedExperience | ParsedProject) -> tuple[int | None, ...]:
    """A dated range with each part inside its own range, and an end that follows its start.

    An end before its start would break the `*_ordered` CHECK. Which of the two the model
    got wrong is unknowable, so the end goes: a period that is open is a smaller claim than
    one that ran backwards.
    """
    start_year, start_month = _year(entry.start_year), _month(entry.start_month)
    end_year, end_month = _year(entry.end_year), _month(entry.end_month)
    if start_year is not None and end_year is not None:
        if (end_year, end_month or 12) < (start_year, start_month or 1):
            end_year, end_month = None, None
    elif end_year is None:
        end_month = None  # a month with no year says nothing and the CHECK ignores it
    return start_year, start_month, end_year, end_month


def _unmapped(names: Iterable[str]) -> list[str]:
    """Every skill nobody could map, once each, in the order the CV mentioned them."""
    seen: dict[str, str] = {}
    for name in names:
        trimmed = _line(name)
        if trimmed is not None:
            seen.setdefault(trimmed.lower(), trimmed)
    return list(seen.values())[:MAX_ENTRIES]


def _line(value: str | None) -> str | None:
    return _text(value, MAX_LINE_LENGTH)


def _paragraph(value: str | None) -> str | None:
    return _text(value, MAX_PARAGRAPH_LENGTH)


def _link(value: str | None) -> str | None:
    return _text(value, MAX_LINK_LENGTH)


def _text(value: str | None, limit: int) -> str | None:
    """Trimmed and cut to length, with "nothing left" meaning absent rather than empty.

    Cut rather than dropped: a description that ran long is still the candidate's own
    description, and they are about to see it and can finish the sentence themselves.
    """
    if value is None:
        return None
    trimmed = value.strip()[:limit].strip()
    return trimmed or None


def _code(value: str | None) -> str | None:
    lowered = _text(value, MAX_LINE_LENGTH)
    return lowered.lower() if lowered else None


def _year(value: int | None) -> int | None:
    return value if value is not None and EARLIEST_YEAR <= value <= LATEST_YEAR else None


def _month(value: int | None) -> int | None:
    return value if value is not None and 1 <= value <= 12 else None


def _years(value: float | None) -> float | None:
    if value is None or value < 0:
        return None
    return round(min(value, MAX_YEARS_EXPERIENCE), YEARS_EXPERIENCE_DECIMALS)
