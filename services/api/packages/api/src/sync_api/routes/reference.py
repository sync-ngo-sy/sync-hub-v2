from __future__ import annotations

from typing import Any, Final

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select

from sync_api.dependencies import SessionDep
from sync_api.errors import openapi_problem
from sync_api.rate_limit import enforce_public_rate_limit
from sync_core.models import Language as LanguageRow
from sync_core.models import SkillCategory, SkillTaxonomy

TOO_MANY: Final[dict[int | str, dict[str, Any]]] = {
    429: openapi_problem("Too many requests from this address."),
}

router = APIRouter(tags=["reference data"], dependencies=[Depends(enforce_public_rate_limit)])


class CanonicalSkill(BaseModel):
    """One skill the platform has a name for, and the heading it belongs under."""

    name: str = Field(description="The Canonical skill's exact name.", examples=["Python"])
    category: str = Field(
        description="What the taxonomy files it under.", examples=["Programming Languages"]
    )


class Language(BaseModel):
    """One language the platform knows, by the code it is stored as and the name it is read as."""

    code: str = Field(description="Its ISO 639-1 code — what a profile stores.", examples=["ar"])
    name: str = Field(description="What to call it on screen.", examples=["Arabic"])


@router.get(
    "/skills",
    operation_id="listCanonicalSkills",
    summary="Every Canonical skill, by category",
    responses=TOO_MANY,
)
async def list_canonical_skills(session: SessionDep) -> list[CanonicalSkill]:
    """The whole taxonomy — a skill named any other way is refused, so this is the only list
    worth offering anyone.

    It arrives by category and then by name, one contiguous run per category, so a picker can
    group it without sorting. Small enough to fetch whole and filter in the browser; there is
    no search here.
    """
    rows = await session.execute(
        select(SkillTaxonomy.canonical_name, SkillCategory.name)
        .join(SkillCategory, SkillCategory.id == SkillTaxonomy.category_id)
        .order_by(SkillCategory.name, SkillTaxonomy.canonical_name)
    )
    return [CanonicalSkill(name=name, category=category) for name, category in rows.tuples()]


@router.get(
    "/languages",
    operation_id="listLanguages",
    summary="Every language the platform knows",
    responses=TOO_MANY,
)
async def list_languages(session: SessionDep) -> list[Language]:
    """By name, so a picker reads in the order it displays. A profile stores the code."""
    rows = await session.execute(
        select(LanguageRow.code, LanguageRow.name).order_by(LanguageRow.name)
    )
    return [Language(code=code, name=name) for code, name in rows.tuples()]
