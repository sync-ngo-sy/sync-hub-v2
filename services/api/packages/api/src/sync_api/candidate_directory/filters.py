from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Annotated, Final

from fastapi import Depends, Query
from pydantic import StringConstraints

from sync_api.dependencies import SessionDep
from sync_api.problems import (
    MALFORMED_LANGUAGE_FILTER_PROBLEM_TYPE,
    MALFORMED_SKILL_FILTER_PROBLEM_TYPE,
    InvalidField,
    Problem,
)
from sync_api.vocabulary import (
    canonical_skill_ids,
    refuse_unknown_canonical_role,
    refuse_unknown_languages,
    refuse_unknown_location,
)
from sync_core.models import LanguageProficiency
from sync_core.profile import MAX_LINE_LENGTH, MAX_YEARS_EXPERIENCE
from sync_core.searchable import CandidateFilters, RequiredLanguage, RequiredSkill

MAX_SKILL_FILTERS: Final = 20

MAX_LANGUAGE_FILTERS: Final = 20

MAX_TOTAL_EXPERIENCE_FILTER: Final = 100

#: A code and the longest proficiency, with the separator between them.
MAX_LANGUAGE_FILTER_LENGTH: Final = 32

FILTER_SEPARATOR: Final = ":"

SkillFilter = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_LINE_LENGTH)
]

LanguageFilter = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_LANGUAGE_FILTER_LENGTH),
]


async def candidate_filters(
    session: SessionDep,
    location_key: Annotated[
        str | None,
        Query(
            max_length=MAX_LINE_LENGTH,
            description="A Location's key, from `/v1/locations`. Matched exactly, so a "
            "governorate never answers for the one beside it.",
            examples=["sy-damascus"],
        ),
    ] = None,
    language: Annotated[
        list[LanguageFilter] | None,
        Query(
            max_length=MAX_LANGUAGE_FILTERS,
            description="A language code, from `/v1/languages`, optionally with the least "
            "proficiency that will do after a colon. Repeat it to name more, and a Candidate "
            "has to speak all of them.",
            examples=[["ar:native", "en:intermediate"]],
        ),
    ] = None,
    role: Annotated[
        str | None,
        Query(
            max_length=MAX_LINE_LENGTH,
            description="A Canonical role's key, from `/v1/roles`.",
            examples=["frontend-engineer"],
        ),
    ] = None,
    min_total_experience: Annotated[
        int | None,
        Query(
            ge=0,
            le=MAX_TOTAL_EXPERIENCE_FILTER,
            description="Whole years of work, at least this many.",
            examples=[3],
        ),
    ] = None,
    skill: Annotated[
        list[SkillFilter] | None,
        Query(
            max_length=MAX_SKILL_FILTERS,
            description="A Canonical skill's exact name, optionally with the years asked of it "
            "after a colon. Repeat it to name more, and a Candidate has to have all of them.",
            examples=[["React:3", "TypeScript"]],
        ),
    ] = None,
) -> CandidateFilters:
    named = list(skill or ())
    spoken = [_spoken(position, raw) for position, raw in enumerate(language or ())]
    await refuse_unknown_location(session, location_key, at="query.location_key")
    await refuse_unknown_canonical_role(session, role, at="query.role")
    await refuse_unknown_languages(
        session,
        {f"query.language.{position}": one.code for position, one in enumerate(spoken)},
    )
    wanted = [_asked(position, raw) for position, raw in enumerate(named)]
    taxonomy = await canonical_skill_ids(
        session, {f"query.skill.{position}": name for position, (name, _) in enumerate(wanted)}
    )
    return CandidateFilters(
        location_key=location_key,
        languages=tuple(spoken),
        canonical_role_key=role,
        minimum_total_experience_years=min_total_experience,
        skills=tuple(
            RequiredSkill(taxonomy_id=taxonomy[name], minimum_years=years) for name, years in wanted
        ),
    )


CandidateFiltersDep = Annotated[CandidateFilters, Depends(candidate_filters)]


def _spoken(position: int, raw: str) -> RequiredLanguage:
    code, separator, tail = raw.strip().rpartition(FILTER_SEPARATOR)
    if not separator:
        return RequiredLanguage(code=tail)
    return RequiredLanguage(code=code, minimum_proficiency=_proficiency(position, tail))


def _proficiency(position: int, tail: str) -> LanguageProficiency:
    try:
        return LanguageProficiency(tail)
    except ValueError:
        raise _unspeakable(position, tail) from None


def _unspeakable(position: int, tail: str) -> Problem:
    spoken = ", ".join(level.value for level in LanguageProficiency)
    return Problem(
        status=422,
        type=MALFORMED_LANGUAGE_FILTER_PROBLEM_TYPE,
        detail="A language filter is a language code, optionally followed by a colon and the "
        "least proficiency that will do.",
        errors=[
            InvalidField(
                location=f"query.language.{position}",
                message=f"“{tail}” is not a proficiency. One of: {spoken}.",
                type="malformed_language_filter",
            ).model_dump()
        ],
    )


def _asked(position: int, raw: str) -> tuple[str, Decimal | None]:
    name, separator, tail = raw.strip().rpartition(FILTER_SEPARATOR)
    if not separator:
        return tail, None
    years = _years(position, tail)
    return name, years


def _years(position: int, tail: str) -> Decimal:
    try:
        years = Decimal(tail)
    except InvalidOperation:
        raise _malformed(position, f"“{tail}” is not a number of years.") from None
    if not years.is_finite() or years < 0 or years > Decimal(str(MAX_YEARS_EXPERIENCE)):
        raise _malformed(position, f"{tail} is not a number of years anybody could have worked.")
    return years


def _malformed(position: int, message: str) -> Problem:
    return Problem(
        status=422,
        type=MALFORMED_SKILL_FILTER_PROBLEM_TYPE,
        detail="A skill filter is a Canonical skill name, optionally followed by a colon and "
        "the years asked of it.",
        errors=[
            InvalidField(
                location=f"query.skill.{position}",
                message=message,
                type="malformed_skill_filter",
            ).model_dump()
        ],
    )
