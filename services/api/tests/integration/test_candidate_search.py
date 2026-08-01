from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from asgi_lifespan import LifespanManager
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.app import create_app
from sync_core import Database, Settings
from sync_core.models import Profile
from tests.support.candidates import a_signed_in_candidate
from tests.support.embedders import FakeEmbedder
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.mailbox import Mailbox
from tests.support.search import SEARCH, a_candidate_with, rewrite_profile
from tests.support.tenants import an_admin
from tests.support.worker import a_reembed_worker, drain

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI

A_BACKEND_ENGINEER: dict[str, Any] = {
    "headline": "Backend engineer, 8 years",
    "summary": "Builds payment systems in Python and PostgreSQL.",
    "location": "Damascus, Syria",
    "preferred_language_code": "ar",
    "skills": [
        {"name": "Python", "years_experience": 8.0},
        {"name": "PostgreSQL", "years_experience": 6.0},
    ],
    "educations": [
        {
            "institution": "Damascus University",
            "degree": "BSc",
            "field_of_study": "Computer Science",
            "graduation_year": 2017,
        }
    ],
}

A_FRONTEND_ENGINEER: dict[str, Any] = {
    "headline": "Frontend engineer",
    "summary": "Builds React interfaces.",
    "location": "Damascus, Syria",
    "preferred_language_code": "en",
    "skills": [
        {"name": "React", "years_experience": 4.0},
        {"name": "TypeScript", "years_experience": 3.0},
    ],
}

A_GRAPHIC_DESIGNER: dict[str, Any] = {
    "headline": "Graphic designer",
    "summary": "Brand identity and print work.",
    "location": "Paris, France",
    "preferred_language_code": "fr",
    "skills": [{"name": "Figma", "years_experience": 5.0}],
}

FOR_A_BACKEND_ENGINEER = {"q": "backend engineer python payment systems"}


@pytest.fixture
def embedder() -> FakeEmbedder:
    return FakeEmbedder()


@pytest.fixture
async def searching(settings: Settings, embedder: FakeEmbedder) -> AsyncIterator[FastAPI]:
    app = create_app(settings, embedder=embedder)
    async with LifespanManager(app):
        yield app


@pytest.fixture
async def recruiter(searching: FastAPI, mailbox: Mailbox) -> AsyncIterator[AsyncClient]:
    async with asgi_client(searching, headers=SPA_HEADERS) as browser:
        await an_admin(browser, mailbox)
        yield browser


async def found(recruiter: AsyncClient, **query: Any) -> list[dict[str, Any]]:
    response = await recruiter.get(SEARCH, params=query)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


def named(matches: list[dict[str, Any]]) -> list[str]:
    return [match["candidate_id"] for match in matches]


async def test_the_closest_profile_comes_first_with_the_fragment_that_matched(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    yusuf = await a_candidate_with(
        searching, mailbox, db_session, label="yusuf", **A_GRAPHIC_DESIGNER
    )
    await drain(a_reembed_worker(database, embedder))

    matches = await found(recruiter, **FOR_A_BACKEND_ENGINEER)

    assert named(matches)[0] == str(amina.id)
    assert str(yusuf.id) in named(matches)
    assert "payment systems" in matches[0]["matched_text"]
    assert matches[0]["headline"] == "Backend engineer, 8 years"


async def test_the_fragment_names_the_section_it_came_from(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    await a_candidate_with(searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER)
    await drain(a_reembed_worker(database, embedder))

    [match] = await found(recruiter, q="BSc computer science Damascus University")

    assert match["matched_section"] == "education"
    assert "Damascus University" in match["matched_text"]


async def test_a_candidate_who_has_not_opted_in_is_not_a_result(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    private = await a_candidate_with(
        searching, mailbox, db_session, label="private", searchable=False, **A_BACKEND_ENGINEER
    )
    await drain(a_reembed_worker(database, embedder))

    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER)) == []
    assert str(private.id) not in named(await found(recruiter, q="python"))


async def test_a_candidate_whose_chunks_are_not_written_yet_is_not_a_result(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    waiting = await a_candidate_with(
        searching, mailbox, db_session, label="waiting", **A_BACKEND_ENGINEER
    )

    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER)) == []

    await drain(a_reembed_worker(database, embedder))
    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER)) == [str(waiting.id)]


async def test_a_result_never_carries_an_email_or_a_phone_number(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    await db_session.execute(
        update(Profile).where(Profile.id == amina.id).values(phone="+963115550134")
    )
    await db_session.commit()
    await drain(a_reembed_worker(database, embedder))

    response = await recruiter.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)

    assert amina.signup.email not in response.text
    assert "+963115550134" not in response.text
    assert set(response.json()["items"][0]) == {
        "candidate_id",
        "full_name",
        "avatar_url",
        "headline",
        "summary",
        "location",
        "preferred_language_code",
        "matched_section",
        "matched_text",
    }


async def test_the_filters_narrow_the_results_together(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    lina = await a_candidate_with(
        searching, mailbox, db_session, label="lina", **A_FRONTEND_ENGINEER
    )
    yusuf = await a_candidate_with(
        searching, mailbox, db_session, label="yusuf", **A_GRAPHIC_DESIGNER
    )
    await drain(a_reembed_worker(database, embedder))
    everyone = {str(amina.id), str(lina.id), str(yusuf.id)}

    assert set(named(await found(recruiter, q="engineer or designer"))) == everyone
    assert set(named(await found(recruiter, q="engineer", location="Damascus"))) == {
        str(amina.id),
        str(lina.id),
    }
    assert set(named(await found(recruiter, q="engineer", language="fr"))) == {str(yusuf.id)}
    assert named(await found(recruiter, q="engineer", location="Damascus", language="en")) == [
        str(lina.id)
    ]
    assert named(await found(recruiter, q="engineer", location="Paris", language="ar")) == []


async def test_keywords_are_a_hard_filter_that_does_not_reorder_what_survives(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    lina = await a_candidate_with(
        searching, mailbox, db_session, label="lina", **A_FRONTEND_ENGINEER
    )
    await drain(a_reembed_worker(database, embedder))

    ranked = named(await found(recruiter, **FOR_A_BACKEND_ENGINEER))
    assert ranked == [str(amina.id), str(lina.id)]

    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER, keywords="React")) == [
        str(lina.id)
    ]
    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER, keywords="Damascus")) == ranked


async def test_editing_a_profile_changes_what_the_recruiter_finds(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    worker = a_reembed_worker(database, embedder)
    await drain(worker)
    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER)) == [str(amina.id)]

    await rewrite_profile(
        searching,
        amina,
        headline="Pastry chef",
        summary="Croissants, and the ovens that ruin them.",
        location="Damascus, Syria",
    )
    await drain(worker)

    [match] = await found(recruiter, q="pastry chef croissants")
    assert match["candidate_id"] == str(amina.id)
    assert match["headline"] == "Pastry chef"
    assert "payment systems" not in match["matched_text"]


async def test_only_a_recruiter_can_search(searching: FastAPI, mailbox: Mailbox) -> None:
    async with asgi_client(searching, headers=SPA_HEADERS) as browser:
        signed_out = await browser.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)
        await a_signed_in_candidate(browser, mailbox)
        candidate = await browser.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)

    assert signed_out.status_code == 401, signed_out.text
    assert candidate.status_code == 403, candidate.text


async def test_search_answers_503_where_no_embedder_is_configured(
    settings: Settings, mailbox: Mailbox
) -> None:
    unconfigured = create_app(settings.model_copy(update={"openai_api_key": None}))
    async with (
        LifespanManager(unconfigured),
        asgi_client(unconfigured, headers=SPA_HEADERS) as browser,
    ):
        await an_admin(browser, mailbox)

        response = await browser.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)

    assert response.status_code == 503, response.text
    assert response.json()["type"] == "urn:sync:problem:search-unavailable"


async def test_a_query_is_embedded_once_per_search(
    searching: FastAPI, recruiter: AsyncClient, embedder: FakeEmbedder
) -> None:
    await found(recruiter, **FOR_A_BACKEND_ENGINEER)

    assert embedder.calls == [[FOR_A_BACKEND_ENGINEER["q"]]]


async def test_a_candidate_search_is_capped_by_its_limit(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    for label in ("first", "second"):
        await a_candidate_with(searching, mailbox, db_session, label=label, **A_BACKEND_ENGINEER)
    await drain(a_reembed_worker(database, embedder))

    assert len(await found(recruiter, **FOR_A_BACKEND_ENGINEER, limit=1)) == 1


async def test_one_candidate_takes_one_place_however_many_chunks_they_have(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    amina = await a_candidate_with(
        searching,
        mailbox,
        db_session,
        label="amina",
        experiences=[
            {"job_title": "Backend engineer", "company_name": "Acme Payments"},
            {"job_title": "Backend engineer", "company_name": "Globex"},
        ],
        **A_BACKEND_ENGINEER,
    )
    await drain(a_reembed_worker(database, embedder))

    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER)) == [str(amina.id)]
