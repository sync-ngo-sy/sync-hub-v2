from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_api.problems import (
    UNKNOWN_CANONICAL_SKILL_PROBLEM_TYPE,
    UNKNOWN_LANGUAGE_PROBLEM_TYPE,
    InvalidField,
    Problem,
)
from sync_core.models import Language, SkillTaxonomy

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


def _refuse_unknown(unknown: Sequence[InvalidField], *, problem_type: str, detail: str) -> None:
    if not unknown:
        return
    raise Problem(
        status=422,
        type=problem_type,
        detail=detail,
        errors=[field.model_dump() for field in unknown],
    )
