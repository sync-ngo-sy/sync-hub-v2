from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

import pytest
from asgi_lifespan import LifespanManager
from httpx import AsyncClient
from sqlalchemy import text, update
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from sync_api.app import create_app
from sync_core import Database, Settings
from sync_core.discovery import CandidateFilters
from sync_core.models import Profile
from sync_rag import CandidateSearch
from sync_rag.search import _page
from tests.support.candidates import a_signed_in_candidate
from tests.support.crm import save_to_pool
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
    "location_key": "sy-damascus",
    "canonical_role_key": "backend-engineer",
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
    "location_key": "sy-damascus",
    "canonical_role_key": "frontend-engineer",
    "preferred_language_code": "en",
    "skills": [
        {"name": "React", "years_experience": 4.0},
        {"name": "TypeScript", "years_experience": 3.0},
    ],
}

A_GRAPHIC_DESIGNER: dict[str, Any] = {
    "headline": "Graphic designer",
    "summary": "Brand identity and print work.",
    "location_key": "fr",
    "canonical_role_key": "graphic-designer",
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


#: Enough for the planner to prefer the vector index over reading the table, which is the
#: whole difference this change is about.
FILLER_CHUNKS = 2000

PAD_THE_CORPUS = text("""
insert into candidate_profile_chunks
  (candidate_id, chunk_type, chunk_text, chunk_index, embedding, embedding_model)
select :candidate_id, 'experience', 'filler ' || i, 100000 + i,
       (select array_agg(random())::vector(768) from generate_series(1, 768)),
       (select model from embedding_models)
from generate_series(1, :chunks) i
""")


async def a_corpus_of(session: AsyncSession, candidate_id: UUID, chunks: int) -> None:
    """Vectors nobody wrote a profile for, so the ranking has something to be a ranking of."""
    await session.execute(PAD_THE_CORPUS, {"candidate_id": candidate_id, "chunks": chunks})
    await session.execute(text("analyze candidate_profile_chunks"))
    await session.commit()


async def how_a_search_runs(session: AsyncSession, embedder: FakeEmbedder) -> str:
    (embedded,) = await embedder.embed(["backend engineer"])
    statement = _page(
        embedded,
        tenant_id=uuid4(),
        filters=CandidateFilters(),
        keywords=None,
        wanted=21,
        offset=0,
    )
    written = statement.compile(
        dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
    )
    await session.execute(text("set local hnsw.iterative_scan = strict_order"))
    explained = await session.execute(text(f"explain (costs off) {written}"))
    return "\n".join(str(line) for (line,) in explained)


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
        "location_key",
        "location_name",
        "canonical_role_key",
        "canonical_role_name",
        "total_experience_years",
        "preferred_language_code",
        "in_talent_pool",
        "matched_section",
        "matched_text",
    }


async def test_a_governorate_never_answers_for_the_one_beside_it(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    """The bug the taxonomy exists to fix, on the Candidate side: "Damascus" was matched inside
    the location, so a Candidate in Rif Dimashq answered for a search of Damascus."""
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    lina = await a_candidate_with(
        searching,
        mailbox,
        db_session,
        label="lina",
        **{**A_FRONTEND_ENGINEER, "location_key": "sy-rif-dimashq"},
    )
    await drain(a_reembed_worker(database, embedder))

    assert named(await found(recruiter, q="engineer", location_key="sy-damascus")) == [
        str(amina.id)
    ]
    assert named(await found(recruiter, q="engineer", location_key="sy-rif-dimashq")) == [
        str(lina.id)
    ]


async def test_a_place_whose_key_contains_another_is_still_a_different_place(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    """The equality, held to the letter. "ma" — Morocco — sits inside "sy-hama", so a filter that
    matched inside the value instead of equalling it would answer either with both."""
    amina = await a_candidate_with(
        searching,
        mailbox,
        db_session,
        label="amina",
        **{**A_BACKEND_ENGINEER, "location_key": "sy-hama"},
    )
    lina = await a_candidate_with(
        searching,
        mailbox,
        db_session,
        label="lina",
        **{**A_FRONTEND_ENGINEER, "location_key": "ma"},
    )
    await drain(a_reembed_worker(database, embedder))

    assert named(await found(recruiter, q="engineer", location_key="ma")) == [str(lina.id)]
    assert named(await found(recruiter, q="engineer", location_key="sy-hama")) == [str(amina.id)]


async def test_a_candidate_is_found_by_the_name_of_their_location(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    """The profile holds a key now, so the keyword vector has to reach through the relation."""
    amina = await a_candidate_with(
        searching,
        mailbox,
        db_session,
        label="amina",
        **{**A_BACKEND_ENGINEER, "location_key": "sy-latakia"},
    )
    await drain(a_reembed_worker(database, embedder))

    [match] = await found(recruiter, q="engineer", keywords="Latakia")

    assert match["candidate_id"] == str(amina.id)
    assert match["location_key"] == "sy-latakia"
    assert match["location_name"] == "Latakia"


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
    assert set(named(await found(recruiter, q="engineer", location_key="sy-damascus"))) == {
        str(amina.id),
        str(lina.id),
    }
    assert set(named(await found(recruiter, q="engineer", language="fr"))) == {str(yusuf.id)}
    assert named(
        await found(recruiter, q="engineer", location_key="sy-damascus", language="en")
    ) == [str(lina.id)]
    assert named(await found(recruiter, q="engineer", location_key="fr", language="ar")) == []


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
        location_key="sy-damascus",
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
            {
                "job_title": "Backend engineer",
                "company_name": "Acme Payments",
                "start_year": 2021,
                "is_current": True,
            },
            {
                "job_title": "Backend engineer",
                "company_name": "Globex",
                "start_year": 2018,
                "end_year": 2021,
            },
        ],
        **A_BACKEND_ENGINEER,
    )
    await drain(a_reembed_worker(database, embedder))

    assert named(await found(recruiter, **FOR_A_BACKEND_ENGINEER)) == [str(amina.id)]


async def test_a_keyword_finds_someone_who_only_listed_it_as_a_skill(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    """The filter used to read a headline and a summary, so "PostgreSQL" found nobody."""
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    await a_candidate_with(searching, mailbox, db_session, label="lina", **A_FRONTEND_ENGINEER)
    await drain(a_reembed_worker(database, embedder))

    assert named(await found(recruiter, q="engineer", keywords="PostgreSQL")) == [str(amina.id)]


async def test_a_keyword_finds_someone_who_only_wrote_it_into_a_job_description(
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
            {
                "job_title": "Engineer",
                "company_name": "Acme",
                "start_year": 2019,
                "end_year": 2024,
                "is_current": False,
                "description": "Ran the settlement pipeline on Kubernetes.",
            }
        ],
        **A_BACKEND_ENGINEER,
    )
    await a_candidate_with(searching, mailbox, db_session, label="lina", **A_FRONTEND_ENGINEER)
    await drain(a_reembed_worker(database, embedder))

    assert named(await found(recruiter, q="engineer", keywords="Kubernetes")) == [str(amina.id)]


async def test_a_keyword_can_exclude(
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

    both = set(named(await found(recruiter, q="engineer")))
    assert both == {str(amina.id), str(lina.id)}
    assert named(await found(recruiter, q="engineer", keywords="-React")) == [str(amina.id)]


async def test_the_fact_filters_narrow_a_search_without_reordering_it(
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

    ranked = named(await found(recruiter, q="engineer"))
    assert set(ranked) == {str(amina.id), str(lina.id)}
    assert named(await found(recruiter, q="engineer", role="backend-engineer")) == [str(amina.id)]
    assert named(await found(recruiter, q="engineer", skill="React")) == [str(lina.id)]
    assert named(await found(recruiter, q="engineer", skill="React:4")) == [str(lina.id)]
    assert await found(recruiter, q="engineer", skill="React:5") == []
    assert named(await found(recruiter, q="engineer", min_total_experience=0)) == ranked


async def test_a_search_result_says_who_is_already_in_the_talent_pool(
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
    await a_candidate_with(searching, mailbox, db_session, label="lina", **A_FRONTEND_ENGINEER)
    await drain(a_reembed_worker(database, embedder))
    saved = await save_to_pool(recruiter, amina.id)
    assert saved.status_code == 200, saved.text

    pooled = {
        match["candidate_id"]: match["in_talent_pool"]
        for match in await found(recruiter, q="engineer")
    }

    assert pooled[str(amina.id)] is True
    assert set(pooled.values()) == {True, False}


async def test_a_search_pages_beyond_the_first(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    for label, profile in (
        ("amina", A_BACKEND_ENGINEER),
        ("lina", A_FRONTEND_ENGINEER),
        ("yusuf", A_GRAPHIC_DESIGNER),
    ):
        await a_candidate_with(searching, mailbox, db_session, label=label, **profile)
    await drain(a_reembed_worker(database, embedder))

    ranked = named(await found(recruiter, q="engineer or designer"))
    assert len(ranked) == 3

    pages = [
        named(await found(recruiter, q="engineer or designer", limit=1, offset=at))
        for at in range(3)
    ]

    assert [row for page in pages for row in page] == ranked


async def test_a_search_says_when_it_has_reached_its_depth(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    """Depth is what stops a ranking pretending to be a list. Two, so three people cross it."""
    for label, profile in (
        ("amina", A_BACKEND_ENGINEER),
        ("lina", A_FRONTEND_ENGINEER),
        ("yusuf", A_GRAPHIC_DESIGNER),
    ):
        await a_candidate_with(searching, mailbox, db_session, label=label, **profile)
    await drain(a_reembed_worker(database, embedder))
    shallow = CandidateSearch(db_session, embedder, depth=2)

    asked = {
        "tenant_id": uuid4(),
        "filters": CandidateFilters(),
        "keywords": None,
        "limit": 1,
    }
    first = await shallow.find("engineer or designer", offset=0, **asked)
    second = await shallow.find("engineer or designer", offset=1, **asked)

    assert len(first.matches) == 1
    assert first.has_more and not first.depth_reached
    assert len(second.matches) == 1
    assert second.has_more and second.depth_reached


async def test_a_search_filtered_to_a_small_population_still_fills_a_page(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    """pgvector filters after the index gives it rows, so without the iterative scan a selective
    filter leaves a handful of survivors and reads exactly like nobody matching."""
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    await drain(a_reembed_worker(database, embedder))
    await a_corpus_of(db_session, amina.id, FILLER_CHUNKS)

    assert named(await found(recruiter, q="engineer", location_key="sy-damascus")) == [
        str(amina.id)
    ]


async def test_the_search_reaches_its_vector_index_rather_than_every_chunk(
    searching: FastAPI,
    recruiter: AsyncClient,
    mailbox: Mailbox,
    db_session: AsyncSession,
    database: Database,
    embedder: FakeEmbedder,
) -> None:
    """The query used to deduplicate before it ranked, which made the index unusable and cost a
    distance for every chunk on the platform."""
    amina = await a_candidate_with(
        searching, mailbox, db_session, label="amina", **A_BACKEND_ENGINEER
    )
    await drain(a_reembed_worker(database, embedder))
    await a_corpus_of(db_session, amina.id, FILLER_CHUNKS)

    plan = await how_a_search_runs(db_session, embedder)

    assert "candidate_profile_chunks_embedding_hnsw" in plan
    assert "Seq Scan on candidate_profile_chunks" not in plan
