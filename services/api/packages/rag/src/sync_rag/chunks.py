from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from decimal import Decimal

    from sync_core.models import CandidateEducation, CandidateExperience, CandidateProject
    from sync_rag.profile import CurrentProfile, NamedSkill, SpokenLanguage


class ChunkType(StrEnum):
    IDENTITY = "identity"
    EXPERIENCE = "experience"
    EDUCATION = "education"
    SKILLS = "skills"
    LANGUAGES = "languages"
    PROJECT = "project"


@dataclass(frozen=True, slots=True)
class ProfileChunk:
    chunk_type: ChunkType
    text: str


def chunks_of(profile: CurrentProfile) -> list[ProfileChunk]:
    written: list[ProfileChunk | None] = [
        _chunk(
            ChunkType.IDENTITY,
            profile.full_name,
            profile.headline,
            profile.location,
            profile.summary,
        )
    ]
    written += (_experience(entry) for entry in profile.experiences)
    if profile.educations:
        written.append(
            _chunk(ChunkType.EDUCATION, "Education", *map(_education, profile.educations))
        )
    named = [*map(_skill, profile.skills), *profile.unmapped_skills]
    if named:
        written.append(_chunk(ChunkType.SKILLS, "Skills", ", ".join(named)))
    if profile.languages:
        written.append(
            _chunk(ChunkType.LANGUAGES, "Languages", ", ".join(map(_language, profile.languages)))
        )
    written += (_project(entry) for entry in profile.projects)
    return [chunk for chunk in written if chunk is not None]


def _chunk(chunk_type: ChunkType, *lines: str | None) -> ProfileChunk | None:
    written = "\n".join(line.strip() for line in lines if line and line.strip())
    return ProfileChunk(chunk_type=chunk_type, text=written) if written else None


def _experience(entry: CandidateExperience) -> ProfileChunk | None:
    held = f"{entry.job_title} at {entry.company_name}" if entry.company_name else entry.job_title
    return _chunk(
        ChunkType.EXPERIENCE,
        _dated(held, _period(entry.start_year, entry.end_year, current=entry.is_current)),
        entry.description,
    )


def _project(entry: CandidateProject) -> ProfileChunk | None:
    return _chunk(
        ChunkType.PROJECT,
        _dated(f"Project: {entry.name}", _period(entry.start_year, entry.end_year)),
        entry.description,
    )


def _education(entry: CandidateEducation) -> str:
    qualification = " in ".join(part for part in (entry.degree, entry.field_of_study) if part)
    studied = f"{qualification} — {entry.institution}" if qualification else entry.institution
    return _dated(studied, str(entry.graduation_year) if entry.graduation_year else "")


def _skill(entry: NamedSkill) -> str:
    if entry.years_experience is None:
        return entry.name
    return f"{entry.name} ({_years(entry.years_experience)})"


def _language(entry: SpokenLanguage) -> str:
    return f"{entry.name} ({entry.proficiency.value})"


def _years(years: Decimal) -> str:
    counted = float(years)
    return f"{counted:g} {'year' if counted == 1 else 'years'}"


def _dated(described: str, period: str) -> str:
    return f"{described} ({period})" if period else described


def _period(start_year: int | None, end_year: int | None, *, current: bool = False) -> str:
    if current:
        return f"current, since {start_year}" if start_year else "current"
    if start_year and end_year:
        return str(start_year) if start_year == end_year else f"{start_year}-{end_year}"
    if start_year:
        return f"since {start_year}"
    return f"until {end_year}" if end_year else ""
