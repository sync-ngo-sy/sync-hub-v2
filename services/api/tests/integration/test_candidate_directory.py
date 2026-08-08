from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import update

from sync_api.app import create_app
from sync_core.models import Profile
from tests.support.candidates import a_signed_in_candidate
from tests.support.crm import save_to_pool
from tests.support.embedders import FakeEmbedder
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.search import (
    DIRECTORY,
    MALFORMED_LANGUAGE_FILTER,
    MALFORMED_SKILL_FILTER,
    SEARCH,
    UNKNOWN_CANONICAL_ROLE,
    UNKNOWN_CANONICAL_SKILL,
    UNKNOWN_LANGUAGE,
    UNKNOWN_LOCATION,
    a_candidate_with,
)
from tests.support.tenants import an_admin
from tests.support.worker import a_reembed_worker, drain

if TYPE_CHECKING:
    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Database, Settings
    from tests.support.mailbox import Mailbox

A_DAMASCUS_BACKEND: dict[str, Any] = {
    "headline": "Backend engineer",
    "location_key": "sy-damascus",
    "canonical_role_key": "backend-engineer",
    "languages": [{"code": "ar", "proficiency": "native"}],
    "skills": [
        {"name": "Python", "years_experience": 8.0},
        {"name": "PostgreSQL", "years_experience": 6.0},
    ],
    "experiences": [
        {
            "job_title": "Backend engineer",
            "company_name": "Acme",
            "start_year": 2016,
            "start_month": 1,
            "end_year": 2024,
            "end_month": 1,
            "is_current": False,
            "description": None,
        }
    ],
}

AN_ALEPPO_FRONTEND: dict[str, Any] = {
    "headline": "Frontend engineer",
    "location_key": "sy-aleppo",
    "canonical_role_key": "frontend-engineer",
    "languages": [
        {"code": "ar", "proficiency": "native"},
        {"code": "en", "proficiency": "fluent"},
    ],
    "skills": [
        {"name": "React", "years_experience": 4.0},
        {"name": "TypeScript", "years_experience": 1.0},
    ],
    "experiences": [
        {
            "job_title": "Frontend engineer",
            "company_name": "Globex",
            "start_year": 2022,
            "start_month": 1,
            "end_year": 2024,
            "end_month": 1,
            "is_current": False,
            "description": None,
        }
    ],
}

A_PARIS_DESIGNER: dict[str, Any] = {
    "headline": "Graphic designer",
    "location_key": "fr",
    "canonical_role_key": "graphic-designer",
    "languages": [{"code": "fr", "proficiency": "native"}],
    "skills": [{"name": "Figma", "years_experience": 5.0}],
    "experiences": [
        {
            "job_title": "Designer",
            "company_name": "Studio",
            "start_year": 2021,
            "start_month": 1,
            "end_year": 2024,
            "end_month": 1,
            "is_current": False,
            "description": None,
        }
    ],
}

LISTED_KEYS = {
    "candidate_id",
    "full_name",
    "avatar_url",
    "headline",
    "summary",
    "location_key",
    "location_name",
    "canonical_role_key",
    "canonical_role_name",
    "total_experience_years",
    "language_names",
    "in_talent_pool",
}


async def listed(recruiter: AsyncClient, **query: Any) -> list[dict[str, Any]]:
    response = await recruiter.get(DIRECTORY, params=query)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


def named(rows: list[dict[str, Any]]) -> list[str]:
    return [row["candidate_id"] for row in rows]


async def three_candidates(app: FastAPI, mailbox: Mailbox, session: AsyncSession) -> dict[str, str]:
    """Written oldest first, so the newest-first order the directory promises is visible."""
    amina = await a_candidate_with(app, mailbox, session, label="amina", **A_DAMASCUS_BACKEND)
    lina = await a_candidate_with(app, mailbox, session, label="lina", **AN_ALEPPO_FRONTEND)
    yusuf = await a_candidate_with(app, mailbox, session, label="yusuf", **A_PARIS_DESIGNER)
    return {"amina": str(amina.id), "lina": str(lina.id), "yusuf": str(yusuf.id)}


async def test_the_directory_answers_with_no_query_written_in_words(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)

    assert set(named(await listed(recruiter))) == set(people.values())


async def test_the_directory_orders_newest_first(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)

    assert named(await listed(recruiter)) == [people["yusuf"], people["lina"], people["amina"]]


async def test_each_filter_narrows_the_directory_on_its_own(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)

    assert named(await listed(recruiter, location_key="sy-damascus")) == [people["amina"]]
    assert named(await listed(recruiter, role="frontend-engineer")) == [people["lina"]]
    assert named(await listed(recruiter, language="fr")) == [people["yusuf"]]
    assert named(await listed(recruiter, skill="Figma")) == [people["yusuf"]]
    assert named(await listed(recruiter, min_total_experience=8)) == [people["amina"]]


async def test_the_filters_combine_and_only_ever_narrow(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)
    together = {"location_key": "sy-aleppo", "role": "frontend-engineer", "language": "en"}

    assert named(await listed(recruiter, **together)) == [people["lina"]]
    assert await listed(recruiter, location_key="sy-aleppo", role="backend-engineer") == []
    assert named(await listed(recruiter, min_total_experience=3)) == [
        people["yusuf"],
        people["amina"],
    ]


async def test_naming_two_skills_answers_with_the_people_who_have_both(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)

    assert named(await listed(recruiter, skill=["React", "TypeScript"])) == [people["lina"]]
    assert await listed(recruiter, skill=["React", "Python"]) == []


async def test_naming_two_languages_answers_with_the_people_who_speak_both(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Lina is the only one with both; naming a pair nobody holds together answers with nobody."""
    people = await three_candidates(app, mailbox, db_session)

    assert named(await listed(recruiter, language=["ar", "en"])) == [people["lina"]]
    assert await listed(recruiter, language=["ar", "fr"]) == []


async def test_a_proficiency_keeps_everyone_who_speaks_it_that_well_or_better(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Lina's English is fluent, which clears intermediate and advanced but not native."""
    people = await three_candidates(app, mailbox, db_session)

    assert named(await listed(recruiter, language="en:intermediate")) == [people["lina"]]
    assert named(await listed(recruiter, language="en:advanced")) == [people["lina"]]
    assert named(await listed(recruiter, language="en:fluent")) == [people["lina"]]
    assert await listed(recruiter, language="en:native") == []


async def test_each_language_carries_its_own_least_proficiency(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Native Arabic and workable English is one question, and Lina is the answer to it."""
    people = await three_candidates(app, mailbox, db_session)

    assert named(await listed(recruiter, language=["ar:native", "en:intermediate"])) == [
        people["lina"]
    ]
    assert await listed(recruiter, language=["ar:native", "en:native"]) == []


async def test_a_proficiency_the_platform_does_not_know_is_refused(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await three_candidates(app, mailbox, db_session)

    response = await recruiter.get(DIRECTORY, params={"language": ["ar", "en:conversational"]})

    assert response.status_code == 422
    problem = response.json()
    assert problem["type"] == MALFORMED_LANGUAGE_FILTER
    assert [error["location"] for error in problem["errors"]] == ["query.language.1"]


async def test_each_row_carries_the_languages_the_candidate_lists_by_name(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)
    by_id = {row["candidate_id"]: row for row in await listed(recruiter)}

    assert by_id[people["lina"]]["language_names"] == ["Arabic", "English"]
    assert by_id[people["yusuf"]]["language_names"] == ["French"]


async def test_a_language_filter_reads_the_languages_a_candidate_lists(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    """Lina lists Arabic and English; naming either finds her, and one she never listed does not."""
    people = await three_candidates(app, mailbox, db_session)

    assert people["lina"] in named(await listed(recruiter, language="ar"))
    assert named(await listed(recruiter, language="en")) == [people["lina"]]
    assert named(await listed(recruiter, language="de")) == []


async def test_a_language_the_platform_does_not_know_is_refused(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    await three_candidates(app, mailbox, db_session)

    response = await recruiter.get(DIRECTORY, params={"language": ["en", "zz"]})

    assert response.status_code == 422
    problem = response.json()
    assert problem["type"] == UNKNOWN_LANGUAGE
    assert [error["location"] for error in problem["errors"]] == ["query.language.1"]


async def test_a_per_skill_year_minimum_is_honoured(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)

    assert named(await listed(recruiter, skill="React:4")) == [people["lina"]]
    assert await listed(recruiter, skill="React:5") == []
    assert await listed(recruiter, skill=["React:4", "TypeScript:3"]) == []


async def test_the_directory_pages_to_the_end(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)
    seen: list[str] = []
    page: dict[str, Any] = {"next_cursor": None}
    asked: dict[str, Any] = {"limit": 1}

    for _ in range(4):
        response = await recruiter.get(DIRECTORY, params=asked)
        assert response.status_code == 200, response.text
        page = response.json()
        seen += named(page["items"])
        if page["next_cursor"] is None:
            break
        asked = {"limit": 1, "cursor": page["next_cursor"]}

    assert page["next_cursor"] is None
    assert seen == [people["yusuf"], people["lina"], people["amina"]]


async def test_a_candidate_awaiting_re_embedding_is_here_and_not_in_global_search(
    settings: Settings, mailbox: Mailbox, db_session: AsyncSession, database: Database
) -> None:
    """Being findable by fact does not wait on a vector, which is the whole point of the split."""
    embedder = FakeEmbedder()
    app = create_app(settings, embedder=embedder)
    async with LifespanManager(app), asgi_client(app, headers=SPA_HEADERS) as browser:
        await an_admin(browser, mailbox)
        waiting = await a_candidate_with(
            app, mailbox, db_session, label="waiting", **A_DAMASCUS_BACKEND
        )

        assert named(await listed(browser)) == [str(waiting.id)]
        before = await browser.get(SEARCH, params={"q": "backend engineer"})
        assert before.json()["items"] == []

        await drain(a_reembed_worker(database, embedder))

        after = await browser.get(SEARCH, params={"q": "backend engineer"})
        assert named(after.json()["items"]) == [str(waiting.id)]


async def test_a_candidate_who_has_not_opted_in_is_not_in_the_directory(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    private = await a_candidate_with(
        app, mailbox, db_session, label="private", searchable=False, **A_DAMASCUS_BACKEND
    )

    assert str(private.id) not in named(await listed(recruiter))


async def test_the_directory_never_carries_a_phone_or_an_email(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_DAMASCUS_BACKEND)
    await db_session.execute(
        update(Profile).where(Profile.id == amina.id).values(phone="+963115550134")
    )
    await db_session.commit()

    response = await recruiter.get(DIRECTORY)

    assert amina.signup.email not in response.text
    assert "+963115550134" not in response.text
    assert set(response.json()["items"][0]) == LISTED_KEYS


async def test_the_directory_says_who_is_already_in_the_talent_pool(
    app: FastAPI, recruiter: AsyncClient, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    people = await three_candidates(app, mailbox, db_session)
    saved = await save_to_pool(recruiter, people["lina"])
    assert saved.status_code == 200, saved.text

    pooled = {row["candidate_id"]: row["in_talent_pool"] for row in await listed(recruiter)}

    assert pooled == {people["yusuf"]: False, people["lina"]: True, people["amina"]: False}


async def test_one_tenants_pool_says_nothing_about_anothers(
    app: FastAPI,
    recruiter: AsyncClient,
    rival: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
) -> None:
    amina = await a_candidate_with(app, mailbox, db_session, label="amina", **A_DAMASCUS_BACKEND)
    await save_to_pool(recruiter, amina.id)

    assert [row["in_talent_pool"] for row in await listed(recruiter)] == [True]
    assert [row["in_talent_pool"] for row in await listed(rival)] == [False]


@pytest.mark.parametrize(
    ("query", "problem"),
    [
        ({"location_key": "atlantis"}, UNKNOWN_LOCATION),
        ({"role": "wizard"}, UNKNOWN_CANONICAL_ROLE),
        ({"skill": "Telepathy"}, UNKNOWN_CANONICAL_SKILL),
        ({"skill": "React:soon"}, MALFORMED_SKILL_FILTER),
    ],
)
async def test_a_filter_the_platform_does_not_know_is_refused_where_it_was_written(
    recruiter: AsyncClient, query: dict[str, Any], problem: str
) -> None:
    response = await recruiter.get(DIRECTORY, params=query)

    assert response.status_code == 422, response.text
    body = response.json()
    assert body["type"] == problem
    assert body["errors"][0]["location"].startswith("query.")


async def test_only_a_recruiter_can_read_the_directory(app: FastAPI, mailbox: Mailbox) -> None:
    async with asgi_client(app, headers=SPA_HEADERS) as browser:
        signed_out = await browser.get(DIRECTORY)
        await a_signed_in_candidate(browser, mailbox)
        candidate = await browser.get(DIRECTORY)

    assert signed_out.status_code == 401, signed_out.text
    assert candidate.status_code == 403, candidate.text
