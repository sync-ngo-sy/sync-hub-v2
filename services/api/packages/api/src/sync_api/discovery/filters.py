from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Annotated, Final

from fastapi import Depends, Query
from pydantic import StringConstraints

from sync_api.dependencies import SessionDep
from sync_api.problems import MALFORMED_SKILL_FILTER_PROBLEM_TYPE, InvalidField, Problem
from sync_api.vocabulary import (
    canonical_skill_ids,
    refuse_unknown_canonical_role,
    refuse_unknown_languages,
    refuse_unknown_location,
)
from sync_core.discovery import CandidateFilters, RequiredSkill
from sync_core.profile import MAX_LINE_LENGTH, MAX_YEARS_EXPERIENCE

MAX_SKILL_FILTERS: Final = 20

MAX_TOTAL_EXPERIENCE_FILTER: Final = 100

#: `React:3` — a Canonical skill name and, after the last colon, the years asked of it.
YEARS_SEPARATOR: Final = ":"

SkillFilter = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_LINE_LENGTH)
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
        str | None,
        Query(max_length=8, description="A Candidate's preferred language code."),
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
    await refuse_unknown_location(session, location_key, at="query.location_key")
    await refuse_unknown_canonical_role(session, role, at="query.role")
    if language is not None:
        await refuse_unknown_languages(session, {"query.language": language})
    wanted = [_asked(position, raw) for position, raw in enumerate(named)]
    taxonomy = await canonical_skill_ids(
        session, {f"query.skill.{position}": name for position, (name, _) in enumerate(wanted)}
    )
    return CandidateFilters(
        location_key=location_key,
        language_code=language,
        canonical_role_key=role,
        minimum_total_experience_years=min_total_experience,
        skills=tuple(
            RequiredSkill(taxonomy_id=taxonomy[name], minimum_years=years) for name, years in wanted
        ),
    )


CandidateFiltersDep = Annotated[CandidateFilters, Depends(candidate_filters)]


def _asked(position: int, raw: str) -> tuple[str, Decimal | None]:
    name, separator, tail = raw.strip().rpartition(YEARS_SEPARATOR)
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
