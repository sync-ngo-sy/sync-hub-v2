from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.problems import (
    UNKNOWN_CANONICAL_ROLE_PROBLEM_TYPE,
    UNKNOWN_CANONICAL_SKILL_PROBLEM_TYPE,
    UNKNOWN_LANGUAGE_PROBLEM_TYPE,
    UNKNOWN_LOCATION_PROBLEM_TYPE,
    InvalidField,
    Problem,
)
from sync_core.models import CanonicalRole, Language, Location, SkillTaxonomy

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession


async def canonical_skill_ids(session: AsyncSession, named: Mapping[str, str]) -> dict[str, UUID]:
    """The taxonomy id of every named Canonical skill, refusing the names it does not have.

    Callers key `named` by where each name sat in the request (`body.skills.0.name`), so a
    refusal points at the entry that caused it instead of at the request as a whole.
    """
    if not named:
        return {}
    rows = await session.execute(
        select(SkillTaxonomy.canonical_name, SkillTaxonomy.id).where(
            SkillTaxonomy.canonical_name.in_(set(named.values()))
        )
    )
    known: dict[str, UUID] = dict(rows.tuples().all())
    _refuse_unknown(
        [
            InvalidField(
                location=location,
                message=f"“{name}” is not a Canonical skill.",
                type="unknown_canonical_skill",
            )
            for location, name in named.items()
            if name not in known
        ],
        problem_type=UNKNOWN_CANONICAL_SKILL_PROBLEM_TYPE,
        detail="Every skill has to be one of the platform's Canonical skills.",
    )
    return known


async def refuse_unknown_languages(session: AsyncSession, named: Mapping[str, str]) -> None:
    """Refuse every language code the platform does not know, located as `canonical_skill_ids`."""
    if not named:
        return
    known = set(
        (
            await session.scalars(select(Language.code).where(Language.code.in_(named.values())))
        ).all()
    )
    _refuse_unknown(
        [
            InvalidField(
                location=location,
                message=f"“{code}” is not a language the platform knows.",
                type="unknown_language",
            )
            for location, code in named.items()
            if code not in known
        ],
        problem_type=UNKNOWN_LANGUAGE_PROBLEM_TYPE,
        detail="Every language has to be one of the platform's language codes.",
    )


async def refuse_unknown_location(session: AsyncSession, key: str | None, *, at: str) -> None:
    """Refuse a Location key the taxonomy does not have.

    One key rather than a mapping, unlike the two above: a Job and a Candidate each sit in one
    place, so `at` is the only field a refusal could ever point at.
    """
    if key is None:
        return
    if await session.scalar(select(Location.key).where(Location.key == key)) is not None:
        return
    _refuse_unknown(
        [
            InvalidField(
                location=at,
                message=f"“{key}” is not a Location the platform knows.",
                type="unknown_location",
            )
        ],
        problem_type=UNKNOWN_LOCATION_PROBLEM_TYPE,
        detail="A location has to be one the platform lists.",
    )


async def refuse_unknown_canonical_role(session: AsyncSession, key: str | None, *, at: str) -> None:
    """Refuse a Canonical role key the taxonomy does not have, located as `refuse_unknown_location`.

    A role is proposed by CV parsing and confirmed by the Candidate, but it is still chosen from
    a list: an unknown key is a bug or a forged request, never a Candidate typing their own.
    """
    if key is None:
        return
    if await session.scalar(select(CanonicalRole.key).where(CanonicalRole.key == key)) is not None:
        return
    _refuse_unknown(
        [
            InvalidField(
                location=at,
                message=f"“{key}” is not a Canonical role.",
                type="unknown_canonical_role",
            )
        ],
        problem_type=UNKNOWN_CANONICAL_ROLE_PROBLEM_TYPE,
        detail="A role has to be one of the platform's Canonical roles.",
    )


def _refuse_unknown(unknown: Sequence[InvalidField], *, problem_type: str, detail: str) -> None:
    if not unknown:
        return
    raise Problem(
        status=422,
        type=problem_type,
        detail=detail,
        errors=[field.model_dump() for field in unknown],
    )
