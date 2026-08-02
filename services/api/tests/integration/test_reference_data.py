from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from sync_core.models import Language, Location, SkillTaxonomy

if TYPE_CHECKING:
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession


async def read_skills(client: AsyncClient) -> list[dict[str, str]]:
    response = await client.get("/v1/skills")
    assert response.status_code == 200
    return response.json()


async def read_languages(client: AsyncClient) -> list[dict[str, str]]:
    response = await client.get("/v1/languages")
    assert response.status_code == 200
    return response.json()


async def test_a_visitor_reads_every_canonical_skill_under_its_category(
    visitor: AsyncClient,
) -> None:
    skills = await read_skills(visitor)

    assert {"name": "Python", "category": "Programming Languages"} in skills
    assert {"name": "Figma", "category": "Design"} in skills


async def test_canonical_skills_arrive_grouped_by_category_and_sorted_by_name(
    visitor: AsyncClient,
) -> None:
    skills = await read_skills(visitor)

    categories = [skill["category"] for skill in skills]
    blocks = [
        category
        for index, category in enumerate(categories)
        if index == 0 or categories[index - 1] != category
    ]

    # One block per category — a category that came back in two pieces would split its heading.
    assert len(blocks) == len(set(blocks))
    assert blocks == sorted(blocks, key=str.casefold)
    for category in blocks:
        named = [skill["name"] for skill in skills if skill["category"] == category]
        assert named == sorted(named, key=str.casefold)


async def test_a_visitor_reads_every_language_by_name_and_code(visitor: AsyncClient) -> None:
    languages = await read_languages(visitor)

    assert {"code": "ar", "name": "Arabic"} in languages
    assert {"code": "en", "name": "English"} in languages


async def test_languages_arrive_sorted_by_name(visitor: AsyncClient) -> None:
    languages = await read_languages(visitor)

    assert [language["name"] for language in languages] == sorted(
        language["name"] for language in languages
    )


async def test_every_canonical_skill_the_taxonomy_holds_is_offered(
    visitor: AsyncClient, db_session: AsyncSession
) -> None:
    """The picker filters in the browser, so a skill missing here cannot be chosen at all."""
    held = set((await db_session.scalars(select(SkillTaxonomy.canonical_name))).all())

    assert {skill["name"] for skill in await read_skills(visitor)} == held


async def test_every_language_the_platform_knows_is_offered(
    visitor: AsyncClient, db_session: AsyncSession
) -> None:
    held = set((await db_session.scalars(select(Language.code))).all())

    assert {language["code"] for language in await read_languages(visitor)} == held


async def read_locations(client: AsyncClient) -> list[dict[str, str]]:
    response = await client.get("/v1/locations")
    assert response.status_code == 200
    return response.json()


async def test_a_visitor_reads_every_syrian_governorate(visitor: AsyncClient) -> None:
    locations = await read_locations(visitor)

    assert {"key": "sy-aleppo", "name": "Aleppo", "group": "Syria"} in locations
    assert len([entry for entry in locations if entry["group"] == "Syria"]) == 14


async def test_a_candidate_outside_syria_has_a_country_to_choose(visitor: AsyncClient) -> None:
    """Otherwise the only honest answer is a blank field, or a governorate they are not in."""
    locations = await read_locations(visitor)

    assert {"key": "de", "name": "Germany", "group": "Outside Syria"} in locations


async def test_the_two_damascus_governorates_are_separate_places(visitor: AsyncClient) -> None:
    named = {location["name"] for location in await read_locations(visitor)}

    assert {"Damascus", "Rif Dimashq"} <= named


async def test_locations_arrive_grouped_by_heading_and_sorted_by_name(
    visitor: AsyncClient,
) -> None:
    locations = await read_locations(visitor)
    groups = [location["group"] for location in locations]

    # One run per heading — a heading that came back in two pieces would be shown twice.
    assert groups == ["Syria"] * groups.count("Syria") + ["Outside Syria"] * groups.count(
        "Outside Syria"
    )
    for block in ("Syria", "Outside Syria"):
        under = [entry["name"] for entry in locations if entry["group"] == block]
        assert under == sorted(under)


async def test_every_location_the_taxonomy_holds_is_offered(
    visitor: AsyncClient, db_session: AsyncSession
) -> None:
    """The picker filters in the browser, so a place missing here cannot be chosen at all."""
    held = set((await db_session.scalars(select(Location.key))).all())

    assert {location["key"] for location in await read_locations(visitor)} == held
