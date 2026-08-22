from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any, Final

from asgi_lifespan import LifespanManager

from sync_api.app import create_app
from tests.support.candidates import a_signed_in_candidate
from tests.support.cvs import upload_cv
from tests.support.embedders import FakeEmbedder
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.logs import capturing_logs, entries
from tests.support.search import DIRECTORY, SEARCH, a_candidate_record, a_candidate_with
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from fastapi import FastAPI
    from httpx import Response
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_core import Settings
    from tests.support.mailbox import Mailbox

RATE_LIMITED: Final = "urn:sync:problem:rate-limited"

A_MINUTE: Final = 60

FOR_A_BACKEND_ENGINEER: Final[dict[str, Any]] = {"q": "backend engineer"}

#: High enough to be out of the way, so a test that shrinks one budget is only testing that one.
UNLIMITED: Final = 100000


@asynccontextmanager
async def throttled_to(settings: Settings, **budgets: int) -> AsyncIterator[FastAPI]:
    app = create_app(settings.model_copy(update=budgets), embedder=FakeEmbedder())
    async with LifespanManager(app):
        yield app


def refusal_of(response: Response) -> int:
    """How long a refused caller is told to wait, having checked the refusal is the limiter's."""
    assert response.status_code == 429, response.text
    assert response.json()["type"] == RATE_LIMITED
    return int(response.headers["Retry-After"])


async def test_paging_the_directory_is_rate_limited(settings: Settings, mailbox: Mailbox) -> None:
    async with (
        throttled_to(settings, directory_rate_limit_max_requests=1) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)

        first = await recruiter.get(DIRECTORY)
        second = await recruiter.get(DIRECTORY)

    assert first.status_code == 200, first.text
    assert 0 < refusal_of(second) <= A_MINUTE


async def test_the_directory_carries_a_daily_budget_as_well(
    settings: Settings, mailbox: Mailbox
) -> None:
    async with (
        throttled_to(
            settings,
            directory_rate_limit_max_requests=UNLIMITED,
            directory_rate_limit_daily_max_requests=1,
        ) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)

        first = await recruiter.get(DIRECTORY)
        second = await recruiter.get(DIRECTORY)

    assert first.status_code == 200, first.text
    assert refusal_of(second) > A_MINUTE


async def test_two_tenants_page_the_directory_on_budgets_of_their_own(
    settings: Settings, mailbox: Mailbox
) -> None:
    async with (
        throttled_to(settings, directory_rate_limit_max_requests=1) as app,
        asgi_client(app, headers=SPA_HEADERS) as acme,
        asgi_client(app, headers=SPA_HEADERS) as rival,
    ):
        await an_admin(acme, mailbox, label="acme")
        await an_admin(rival, mailbox, label="rival")

        spent = await acme.get(DIRECTORY)
        refused = await acme.get(DIRECTORY)
        theirs = await rival.get(DIRECTORY)

    assert spent.status_code == 200, spent.text
    assert refusal_of(refused) > 0
    assert theirs.status_code == 200, theirs.text


async def test_reading_contact_details_is_rate_limited(
    settings: Settings, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    async with (
        throttled_to(settings, candidate_record_rate_limit_max_requests=1) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)
        amina = await a_candidate_with(app, mailbox, db_session, label="amina")
        record = a_candidate_record(amina.id)

        first = await recruiter.get(record)
        second = await recruiter.get(record)

    assert first.status_code == 200, first.text
    assert first.json()["email"]
    assert 0 < refusal_of(second) <= A_MINUTE


async def test_contact_details_carry_a_daily_budget_as_well(
    settings: Settings, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    async with (
        throttled_to(
            settings,
            candidate_record_rate_limit_max_requests=UNLIMITED,
            candidate_record_rate_limit_daily_max_requests=1,
        ) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)
        amina = await a_candidate_with(app, mailbox, db_session, label="amina")
        record = a_candidate_record(amina.id)

        first = await recruiter.get(record)
        second = await recruiter.get(record)

    assert first.status_code == 200, first.text
    assert refusal_of(second) > A_MINUTE


async def test_a_contact_read_says_who_read_whom(
    settings: Settings, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    async with (
        throttled_to(settings) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)
        amina = await a_candidate_with(app, mailbox, db_session, label="amina")

        with capturing_logs() as log:
            read = await recruiter.get(a_candidate_record(amina.id))

    assert read.status_code == 200, read.text
    reads = [entry for entry in entries(log) if entry.get("event") == "directory.contact_read"]
    assert len(reads) == 1
    assert reads[0]["candidate_id"] == str(amina.id)
    assert reads[0]["tenant_id"]
    assert reads[0]["profile_id"]


async def test_the_directory_and_a_contact_read_do_not_share_a_budget(
    settings: Settings, mailbox: Mailbox, db_session: AsyncSession
) -> None:
    async with (
        throttled_to(settings, candidate_record_rate_limit_max_requests=1) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)
        amina = await a_candidate_with(app, mailbox, db_session, label="amina")

        spent = await recruiter.get(a_candidate_record(amina.id))
        refused = await recruiter.get(a_candidate_record(amina.id))
        listed = await recruiter.get(DIRECTORY)

    assert spent.status_code == 200, spent.text
    assert refusal_of(refused) > 0
    assert listed.status_code == 200, listed.text


async def test_searching_is_rate_limited(settings: Settings, mailbox: Mailbox) -> None:
    async with (
        throttled_to(settings, search_rate_limit_max_requests=1) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)

        first = await recruiter.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)
        second = await recruiter.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)

    assert first.status_code == 200, first.text
    assert 0 < refusal_of(second) <= A_MINUTE


async def test_searching_carries_a_daily_budget_as_well(
    settings: Settings, mailbox: Mailbox
) -> None:
    async with (
        throttled_to(
            settings,
            search_rate_limit_max_requests=UNLIMITED,
            search_rate_limit_daily_max_requests=1,
        ) as app,
        asgi_client(app, headers=SPA_HEADERS) as recruiter,
    ):
        await an_admin(recruiter, mailbox)

        first = await recruiter.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)
        second = await recruiter.get(SEARCH, params=FOR_A_BACKEND_ENGINEER)

    assert first.status_code == 200, first.text
    assert refusal_of(second) > A_MINUTE


async def test_uploading_cvs_is_rate_limited(settings: Settings, mailbox: Mailbox) -> None:
    async with (
        throttled_to(settings, cv_upload_rate_limit_max_requests=1) as app,
        asgi_client(app, headers=SPA_HEADERS) as candidate,
    ):
        await a_signed_in_candidate(candidate, mailbox)

        first = await upload_cv(candidate)
        second = await upload_cv(candidate)

    assert first.status_code == 201, first.text
    assert 0 < refusal_of(second) <= A_MINUTE


async def test_uploading_cvs_carries_a_daily_budget_as_well(
    settings: Settings, mailbox: Mailbox
) -> None:
    async with (
        throttled_to(
            settings,
            cv_upload_rate_limit_max_requests=UNLIMITED,
            cv_upload_rate_limit_daily_max_requests=1,
        ) as app,
        asgi_client(app, headers=SPA_HEADERS) as candidate,
    ):
        await a_signed_in_candidate(candidate, mailbox)

        first = await upload_cv(candidate)
        second = await upload_cv(candidate)

    assert first.status_code == 201, first.text
    assert refusal_of(second) > A_MINUTE


async def test_two_candidates_upload_on_budgets_of_their_own(
    settings: Settings, mailbox: Mailbox
) -> None:
    async with (
        throttled_to(settings, cv_upload_rate_limit_max_requests=1) as app,
        asgi_client(app, headers=SPA_HEADERS) as amina,
        asgi_client(app, headers=SPA_HEADERS) as bashir,
    ):
        await a_signed_in_candidate(amina, mailbox, "amina")
        await a_signed_in_candidate(bashir, mailbox, "bashir")

        spent = await upload_cv(amina)
        refused = await upload_cv(amina)
        theirs = await upload_cv(bashir)

    assert spent.status_code == 201, spent.text
    assert refusal_of(refused) > 0
    assert theirs.status_code == 201, theirs.text
