from __future__ import annotations

from typing import Any, Final

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import case, select

from sync_api.dependencies import SessionDep
from sync_api.errors import openapi_problem
from sync_api.rate_limit import enforce_public_rate_limit
from sync_core.models import Language as LanguageRow
from sync_core.models import Location as LocationRow
from sync_core.models import LocationKind, SkillCategory, SkillTaxonomy

TOO_MANY: Final[dict[int | str, dict[str, Any]]] = {
    429: openapi_problem("Too many requests from this address."),
}

#: The two headings a picker shows. Syria is resolved to the governorate and everywhere else
#: to the country, so those are the only two kinds of answer there are.
IN_SYRIA: Final = "Syria"
OUTSIDE_SYRIA: Final = "Outside Syria"

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


class Location(BaseModel):
    """One place a Job or a Candidate can be, and the heading it belongs under."""

    key: str = Field(
        description="What a Job and a profile store, and what a filter matches exactly.",
        examples=["sy-aleppo"],
    )
    name: str = Field(description="What to call it on screen.", examples=["Aleppo"])
    group: str = Field(
        description=f"“{IN_SYRIA}” for a governorate, “{OUTSIDE_SYRIA}” for a country.",
        examples=[IN_SYRIA],
    )


@router.get(
    "/locations",
    operation_id="listLocations",
    summary="Every Location the platform has",
    responses=TOO_MANY,
)
async def list_locations(session: SessionDep) -> list[Location]:
    """The whole taxonomy — a place named any other way cannot be stored, so this is the only
    list worth offering anyone.

    Syria's governorates first and then the countries, each group in one contiguous run so a
    picker can group it without sorting. Small enough to fetch whole and filter in the browser;
    there is no search here.
    """
    is_a_country = LocationRow.kind == LocationKind.COUNTRY
    group = case((is_a_country, OUTSIDE_SYRIA), else_=IN_SYRIA).label("group")
    rows = await session.execute(
        select(LocationRow.key, LocationRow.name, group).order_by(is_a_country, LocationRow.name)
    )
    return [Location(key=key, name=name, group=group) for key, name, group in rows.tuples()]


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
