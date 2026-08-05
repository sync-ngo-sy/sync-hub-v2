from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import TYPE_CHECKING, Final

from sync_core.models import LanguageProficiency, QualificationStatus, SkillImportance

if TYPE_CHECKING:
    from collections.abc import Iterator
    from uuid import UUID

#: Recorded on every verdict, so a rule change can be told from a data change afterwards.
#: "2" is the rule reading one stored Total experience instead of measuring dates: it rounds to
#: whole years, which lets work that fell just short of a bar clear it, and it no longer sends
#: undatable work to a human, because a Snapshot can no longer hold any.
SCREENING_VERSION: Final = "2"

#: `language_proficiency` is an unordered enum in Postgres; this is the order it means.
_PROFICIENCIES: Final = (
    LanguageProficiency.BEGINNER,
    LanguageProficiency.INTERMEDIATE,
    LanguageProficiency.ADVANCED,
    LanguageProficiency.FLUENT,
    LanguageProficiency.NATIVE,
)


@dataclass(frozen=True, slots=True)
class SkillCriterion:
    """One Canonical skill the Job asks for. Only a `required` one can refuse an applicant."""

    taxonomy_id: UUID
    name: str
    importance: SkillImportance
    minimum_years: int | None


@dataclass(frozen=True, slots=True)
class LanguageCriterion:
    """One language an applicant has to speak, and how well."""

    code: str
    name: str
    minimum_proficiency: LanguageProficiency


@dataclass(frozen=True, slots=True)
class KnockoutQuestion:
    """A `yes_no` question with an answer that has to be given to get past it."""

    question_id: UUID
    question_text: str
    accepted_boolean_answer: bool


@dataclass(frozen=True, slots=True)
class Criteria:
    """The bar the Job measures an applicant against."""

    minimum_total_experience_years: Decimal | None = None
    skills: tuple[SkillCriterion, ...] = ()
    languages: tuple[LanguageCriterion, ...] = ()
    knockouts: tuple[KnockoutQuestion, ...] = ()


@dataclass(frozen=True, slots=True)
class SnapshotSkill:
    taxonomy_id: UUID
    years_experience: Decimal | None


@dataclass(frozen=True, slots=True)
class SnapshotLanguage:
    code: str
    proficiency: LanguageProficiency


@dataclass(frozen=True, slots=True)
class SnapshotAnswer:
    question_id: UUID
    answer_boolean: bool | None


@dataclass(frozen=True, slots=True)
class Snapshot:
    """The immutable application data a verdict is drawn from, and nothing else."""

    skills: tuple[SnapshotSkill, ...] = ()
    #: Frozen at submission from the Candidate's profile, never re-derived here: Screening
    #: compares one number to another and does no arithmetic over dates at all.
    total_experience_years: int = 0
    languages: tuple[SnapshotLanguage, ...] = ()
    answers: tuple[SnapshotAnswer, ...] = ()


@dataclass(frozen=True, slots=True)
class Verdict:
    status: QualificationStatus
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class _Finding:
    """One rule that did not pass, and whether it refuses the applicant or only doubts them."""

    settled: bool
    reason: str


def screen(criteria: Criteria, snapshot: Snapshot) -> Verdict:
    """Judge one Application against one Job's criteria. Deterministic, and no score.

    A rule that fails outright refuses the applicant; one that cannot be answered from the
    Snapshot asks for a human. The first kind outranks the second.
    """
    findings = list(_findings(criteria, snapshot))
    refused = [finding for finding in findings if finding.settled]
    if refused:
        return Verdict(status=QualificationStatus.DISQUALIFIED, reason=_reason(refused))
    if findings:
        return Verdict(status=QualificationStatus.REVIEW_REQUIRED, reason=_reason(findings))
    return Verdict(status=QualificationStatus.QUALIFIED)


def _findings(criteria: Criteria, snapshot: Snapshot) -> Iterator[_Finding]:
    yield from _skill_findings(criteria, snapshot)
    yield from _experience_findings(criteria, snapshot)
    yield from _language_findings(criteria, snapshot)
    yield from _knockout_findings(criteria, snapshot)


def _skill_findings(criteria: Criteria, snapshot: Snapshot) -> Iterator[_Finding]:
    held = {skill.taxonomy_id: skill for skill in snapshot.skills}
    for criterion in criteria.skills:
        if criterion.importance is not SkillImportance.REQUIRED:
            continue
        skill = held.get(criterion.taxonomy_id)
        if skill is None:
            yield _refused(f"{criterion.name} is required and the application does not list it")
        elif criterion.minimum_years is None:
            continue
        elif skill.years_experience is None:
            yield _doubted(
                f"{criterion.name} asks for {criterion.minimum_years} years and the "
                "application does not say how long"
            )
        elif skill.years_experience < criterion.minimum_years:
            yield _refused(
                f"{criterion.name} asks for {criterion.minimum_years} years and the "
                f"application has {skill.years_experience}"
            )


def _language_findings(criteria: Criteria, snapshot: Snapshot) -> Iterator[_Finding]:
    spoken = {language.code: language.proficiency for language in snapshot.languages}
    for criterion in criteria.languages:
        proficiency = spoken.get(criterion.code)
        wanted = criterion.minimum_proficiency
        if proficiency is None:
            yield _refused(f"{criterion.name} is required and the application does not list it")
        elif _PROFICIENCIES.index(proficiency) < _PROFICIENCIES.index(wanted):
            yield _refused(
                f"{criterion.name} is required at {wanted.value} and the application "
                f"says {proficiency.value}"
            )


def _knockout_findings(criteria: Criteria, snapshot: Snapshot) -> Iterator[_Finding]:
    """An unanswered knockout is a bar nobody has been shown to clear, not one they failed —
    which only happens where the Recruiter left the question optional."""
    answered = {answer.question_id: answer.answer_boolean for answer in snapshot.answers}
    for knockout in criteria.knockouts:
        given = answered.get(knockout.question_id)
        if given is None:
            yield _doubted(f"“{knockout.question_text}” was not answered")
        elif given is not knockout.accepted_boolean_answer:
            yield _refused(f"“{knockout.question_text}” was answered {_spoken(given)}")


def _spoken(answer: bool) -> str:
    return "yes" if answer else "no"


def _experience_findings(criteria: Criteria, snapshot: Snapshot) -> Iterator[_Finding]:
    """One number against another. Dates are mandatory on an experience entry, so "short of the
    bar only because some work could not be dated" is no longer a state that exists."""
    wanted = criteria.minimum_total_experience_years
    if wanted is None or snapshot.total_experience_years >= wanted:
        return
    yield _refused(
        f"the role asks for {wanted} years of work and the application has "
        f"{snapshot.total_experience_years}"
    )


def _refused(reason: str) -> _Finding:
    return _Finding(settled=True, reason=reason)


def _doubted(reason: str) -> _Finding:
    return _Finding(settled=False, reason=reason)


def _reason(findings: list[_Finding]) -> str:
    return "; ".join(finding.reason for finding in findings)
