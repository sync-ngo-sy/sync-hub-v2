from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sync_core.models import EmploymentType, SkillImportance

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator

    from sync_assessments.assessor import (
        AskedQuestion,
        AssessedApplication,
        AssessedJob,
        BuiltProject,
        HeldEducation,
        HeldExperience,
        HeldSkill,
        MatchRequest,
        RequiredLanguage,
        RequiredSkill,
        SpokenLanguage,
    )

#: Recorded on every assessment, so a prompt change can be told from a data change
#: afterwards. Bump it whenever the instructions or the document below change.
PROMPT_VERSION: Final = "1"

INSTRUCTIONS: Final = """\
You are advising a recruiter on how well one job application answers one job's requirements.

Rules:
- Judge only what the two documents say. The application is a frozen snapshot of what the \
candidate sent; treat anything it does not state as absent rather than assumed.
- `match_percentage` is how much of what the job asks for the application evidences, from 0 \
to 100. Weigh the required skills, the minimum total experience and the required languages \
above the preferred ones, and weigh evidence of doing the work above claiming it.
- Say what the evidence is. "Six years of Python across two payment systems" is worth \
reading; "strong technical background" is not.
- Never recommend hiring or rejecting, and never rank this candidate against anyone else. \
The recruiter decides, and a separate deterministic screening has already ruled on whether \
the application meets the criteria at all.
- Judge the work, not the person: nothing about where a candidate studied, where they are, \
or what language they speak counts except where the job asks for it.
"""

_NOTHING: Final = "not stated"

#: The model reads prose, and `full_time` is not prose. A member with no word here would raise
#: mid-assessment, so a test walks the enum rather than trusting the dict to keep up with it.
_EMPLOYMENT_TYPES: Final[dict[EmploymentType, str]] = {
    EmploymentType.FULL_TIME: "Full time",
    EmploymentType.PART_TIME: "Part time",
    EmploymentType.CONTRACT: "Contract",
    EmploymentType.TEMPORARY: "Temporary",
    EmploymentType.INTERNSHIP: "Internship",
    EmploymentType.VOLUNTEER: "Volunteer",
}


def as_document(request: MatchRequest) -> str:
    """The whole input the model reads, as one document. Versioned with the instructions."""
    return f"{_job(request.job)}\n\n{_application(request.application)}"


def _job(job: AssessedJob) -> str:
    return _section(
        "THE JOB",
        _field("Title", job.title),
        _field("Location", job.location),
        _field("Employment type", _employment(job.employment_type)),
        _field(
            "Minimum total experience",
            None
            if job.minimum_total_experience_years is None
            else f"{job.minimum_total_experience_years} years",
        ),
        _field("Required skills", _skills(job.skills, SkillImportance.REQUIRED)),
        _field("Preferred skills", _skills(job.skills, SkillImportance.PREFERRED)),
        _field("Required languages", _joined(_language(entry) for entry in job.languages)),
        _prose("Description", job.description),
    )


def _employment(kind: EmploymentType | None) -> str | None:
    return None if kind is None else _EMPLOYMENT_TYPES[kind]


def _application(application: AssessedApplication) -> str:
    return _section(
        "THE APPLICATION",
        _field("Headline", application.headline),
        _field("Location", application.location),
        _field("Skills", _joined(_held_skill(entry) for entry in application.skills)),
        _field("Languages", _joined(_spoken(entry) for entry in application.languages)),
        _prose("Summary", application.summary),
        _list("Experience", [_experience(entry) for entry in application.experiences]),
        _list("Education", [_education(entry) for entry in application.educations]),
        _list("Projects", [_project(entry) for entry in application.projects]),
        _list("Answers to the job's questions", [_answer(entry) for entry in application.answers]),
    )


def _section(heading: str, *parts: str | None) -> str:
    written = [part for part in parts if part]
    return "\n".join([heading, "=" * len(heading), *written])


def _field(label: str, value: str | None) -> str | None:
    return None if not value else f"{label}: {value}"


def _list(label: str, entries: list[str]) -> str | None:
    return None if not entries else "\n".join([f"\n{label}:", *(f"- {entry}" for entry in entries)])


def _prose(label: str, written: str | None) -> str | None:
    return None if not written else f"\n{label}:\n{written}"


def _joined(values: Iterator[str]) -> str | None:
    return ", ".join(values) or None


def _skills(skills: Iterable[RequiredSkill], importance: SkillImportance) -> str | None:
    return _joined(_required_skill(skill) for skill in skills if skill.importance is importance)


def _required_skill(skill: RequiredSkill) -> str:
    if skill.minimum_years is None:
        return skill.name
    return f"{skill.name} (at least {skill.minimum_years} years)"


def _language(language: RequiredLanguage) -> str:
    return f"{language.name} (at least {language.minimum_proficiency.value})"


def _held_skill(skill: HeldSkill) -> str:
    if skill.years_experience is None:
        return f"{skill.name} (years {_NOTHING})"
    return f"{skill.name} ({skill.years_experience} years)"


def _spoken(language: SpokenLanguage) -> str:
    return f"{language.name} ({language.proficiency.value})"


def _experience(experience: HeldExperience) -> str:
    at = f" at {experience.company_name}" if experience.company_name else ""
    when = _period(experience)
    said = f": {experience.description}" if experience.description else ""
    return f"{experience.job_title}{at} ({when}){said}"


def _period(experience: HeldExperience) -> str:
    started = _month(experience.start_year, experience.start_month)
    if experience.is_current:
        return f"{started} to now"
    ended = _month(experience.end_year, experience.end_month)
    return f"{started} to {ended}"


def _month(year: int | None, month: int | None) -> str:
    if year is None:
        return _NOTHING
    return f"{year}" if month is None else f"{year}-{month:02d}"


def _education(education: HeldEducation) -> str:
    studied = f" in {education.field_of_study}" if education.field_of_study else ""
    graduated = f", {education.graduation_year}" if education.graduation_year else ""
    return f"{education.degree or _NOTHING}{studied} — {education.institution}{graduated}"


def _project(project: BuiltProject) -> str:
    return f"{project.name}: {project.description}" if project.description else project.name


def _answer(answered: AskedQuestion) -> str:
    return f"“{answered.question}” — {answered.answer}"
