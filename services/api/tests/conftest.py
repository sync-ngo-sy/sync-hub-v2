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
from collections.abc import AsyncGenerator, AsyncIterator, Iterator
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import asyncpg
import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from sync_api.app import create_app
from sync_core import Database, Settings, get_settings
from tests.support import stack

if TYPE_CHECKING:
    from fastapi import FastAPI
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


@asynccontextmanager
async def asgi_client(app: FastAPI) -> AsyncGenerator[AsyncClient]:
    """An HTTP client speaking to `app` in-process.

    `raise_app_exceptions=False` because Starlette re-raises after its handler runs; without
    it, a test could never observe the 500 problem+json an unhandled error produces.
    """
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
        yield http_client


@pytest.fixture(scope="session")
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(app) as http_client:
        yield http_client


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
