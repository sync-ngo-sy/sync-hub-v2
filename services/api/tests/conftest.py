"""Fixtures putting every test in front of a real, freshly-emptied Supabase stack.

The suite's primary seam is the HTTP boundary: a test drives the ASGI app with httpx and
asserts on the response plus the resulting database state. Nothing below stubs the
database — `supabase start` supplies the real Postgres with the real migrations, triggers
and constraints, plus GoTrue and Storage.

Isolation is truncate-and-reseed rather than a rolled-back transaction, because worker
tests need writes to be committed and visible from another connection.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING

import asyncpg
import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import text

from sync_api.app import create_app
from sync_core import Database, Settings, get_settings
from tests.support import stack
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.mailbox import Mailbox, mailbox_at

if TYPE_CHECKING:
    from fastapi import FastAPI
    from httpx import AsyncClient
    from sqlalchemy.ext.asyncio import AsyncSession

SKIP_RESET_ENV_VAR = "SYNC_TEST_SKIP_DB_RESET"


@pytest.fixture(scope="session", autouse=True)
def _stack_environment() -> Iterator[None]:
    """Point the process at the running local stack, whatever a developer's `.env` says.

    Values come from `supabase status`, so nothing about the stack is duplicated here and
    a rotated local key cannot silently break the suite.
    """
    config = stack.stack_config()
    os.environ.update(
        {
            "SYNC_ENVIRONMENT": "ci" if os.environ.get("CI") else "local",
            "SYNC_DATABASE_URL": config["DB_URL"].replace(
                "postgresql://", "postgresql+asyncpg://", 1
            ),
            "SYNC_SUPABASE_URL": config["API_URL"],
            "SYNC_SUPABASE_SERVICE_ROLE_KEY": config["SERVICE_ROLE_KEY"],
            "SYNC_SUPABASE_ANON_KEY": config["ANON_KEY"],
            # The suite signs in far more often than any real caller, from one address. The
            # limiter itself is tested in `test_auth_protections.py`, against an app built
            # with a limit small enough to reach on purpose.
            "SYNC_AUTH_RATE_LIMIT_MAX_REQUESTS": "100000",
        }
    )
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="session", autouse=True)
def _migrated_database(_stack_environment: None) -> None:
    """Re-run every migration once per session, so the suite starts from the real schema."""
    if os.environ.get(SKIP_RESET_ENV_VAR) == "1":
        return
    stack.reset_database()


@pytest.fixture(scope="session")
def settings(_stack_environment: None) -> Settings:
    return get_settings()


@pytest.fixture(scope="session")
async def database(settings: Settings, _migrated_database: None) -> AsyncIterator[Database]:
    """The engine the tests themselves query through, separate from the app's."""
    db = Database(settings)
    yield db
    await db.dispose()


@pytest.fixture(scope="session")
async def _cleanup_connection(
    settings: Settings, _migrated_database: None
) -> AsyncIterator[asyncpg.Connection]:
    """A raw asyncpg connection reserved for resetting state between tests.

    Raw, because truncation and the reference-seed replay are multi-statement scripts and
    asyncpg only accepts those over the simple query protocol — SQLAlchemy always prepares.
    """
    connection = await asyncpg.connect(str(settings.database_url).replace("+asyncpg", "", 1))
    yield connection
    await connection.close()


@pytest.fixture(scope="session")
async def _data_tables(database: Database) -> list[str]:
    async with database.session() as session:
        result = await session.execute(
            text("select tablename from pg_tables where schemaname = 'public' order by tablename")
        )
        return [row[0] for row in result]


@pytest.fixture(autouse=True)
async def _clean_slate(
    _cleanup_connection: asyncpg.Connection,
    _data_tables: list[str],
) -> None:
    """Empty every data table and replay the reference seed, before each test."""
    await _cleanup_connection.execute(stack.truncate_script(_data_tables))
    await _cleanup_connection.execute(stack.reference_seed_sql())


@pytest.fixture
async def db_session(database: Database) -> AsyncIterator[AsyncSession]:
    """A session for arranging fixtures and asserting on what a request left behind."""
    async with database.session() as session:
        yield session


@pytest.fixture(scope="session")
async def app(settings: Settings, _migrated_database: None) -> AsyncIterator[FastAPI]:
    application = create_app(settings)
    async with LifespanManager(application):
        yield application


@pytest.fixture(scope="session")
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(app) as http_client:
        yield http_client


@pytest.fixture
async def second_browser(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """A second, independent SPA client — its own cookie jar, for tests with two actors.

    E.g. a Tenant admin inviting a teammate: `browser` stays the admin throughout, and this
    is who accepts the invite and acts as the teammate afterwards.
    """
    async with asgi_client(app, headers=SPA_HEADERS) as http_client:
        yield http_client


@pytest.fixture
async def browser(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """One SPA's worth of client: its own cookie jar, and the CSRF header it always sends.

    Function-scoped, unlike `client`, because a session is state — a test inheriting the
    previous one's cookies would be testing the jar rather than the API.
    """
    async with asgi_client(app, headers=SPA_HEADERS) as http_client:
        yield http_client


@pytest.fixture(scope="session")
async def mailbox(_stack_environment: None) -> AsyncIterator[Mailbox]:
    """Where every email GoTrue sends actually lands."""
    async for inbox in mailbox_at(stack.stack_config()["MAILPIT_URL"]):
        yield inbox


@pytest.fixture(scope="session")
async def failing_client(settings: Settings) -> AsyncIterator[AsyncClient]:
    """A client for an app carrying routes that fail the way real routes will.

    The failures belong to the tests, not to the service, so they are mounted on their own
    app rather than shipped in the router.
    """
    app = create_app(settings)

    @app.get("/v1/demo/echo")
    async def echo(count: int) -> dict[str, int]:
        return {"count": count}

    @app.get("/v1/demo/boom")
    async def boom() -> dict[str, str]:
        raise RuntimeError("credentials=hunter2 leaked into the exception message")

    async with LifespanManager(app), asgi_client(app) as http_client:
        yield http_client
