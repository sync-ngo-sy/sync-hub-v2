from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING

import asyncpg
import pytest
from asgi_lifespan import LifespanManager
from httpx import AsyncClient
from sqlalchemy import text

from sync_api.app import create_app
from sync_core import Database, Settings, Storage, get_settings
from tests.support import stack
from tests.support.cvs import empty_cv_bucket
from tests.support.harness import SPA_HEADERS, asgi_client
from tests.support.mailbox import Mailbox, mailbox_at
from tests.support.tenants import an_admin

if TYPE_CHECKING:
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncSession

SKIP_RESET_ENV_VAR = "SYNC_TEST_SKIP_DB_RESET"

#: Not stack-derived, and has to match `additional_redirect_urls` in supabase/config.toml.
RECRUITER_PORTAL_URL = "http://127.0.0.1:5174"


@pytest.fixture(scope="session", autouse=True)
def _stack_environment() -> Iterator[None]:
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
            "SYNC_AUTH_RATE_LIMIT_MAX_REQUESTS": "100000",
            "SYNC_PUBLIC_RATE_LIMIT_MAX_REQUESTS": "100000",
            "SYNC_ASSESSMENT_RATE_LIMIT_MAX_REQUESTS": "100000",
            "SYNC_RECRUITER_PORTAL_URL": RECRUITER_PORTAL_URL,
        }
    )
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="session", autouse=True)
def _migrated_database(_stack_environment: None) -> None:
    if os.environ.get(SKIP_RESET_ENV_VAR) == "1":
        return
    stack.reset_database()


@pytest.fixture(scope="session")
def settings(_stack_environment: None) -> Settings:
    return get_settings()


@pytest.fixture(scope="session")
async def database(settings: Settings, _migrated_database: None) -> AsyncIterator[Database]:
    db = Database(settings)
    yield db
    await db.dispose()


@pytest.fixture(scope="session")
async def _cleanup_connection(
    settings: Settings, _migrated_database: None
) -> AsyncIterator[asyncpg.Connection]:
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


@pytest.fixture(scope="session")
async def storage(settings: Settings) -> AsyncIterator[Storage]:
    bucket = Storage.build(settings)
    yield bucket
    await bucket.aclose()


@pytest.fixture(autouse=True)
async def _clean_slate(
    _cleanup_connection: asyncpg.Connection,
    _data_tables: list[str],
    storage: Storage,
) -> None:
    await empty_cv_bucket(_cleanup_connection, storage)
    await _cleanup_connection.execute(stack.truncate_script(_data_tables))
    await _cleanup_connection.execute(stack.reference_seed_sql())


@pytest.fixture
async def db_session(database: Database) -> AsyncIterator[AsyncSession]:
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


@pytest.fixture(scope="session")
async def web() -> AsyncIterator[AsyncClient]:
    async with AsyncClient() as http_client:
        yield http_client


@pytest.fixture
async def browser(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(app, headers=SPA_HEADERS) as http_client:
        yield http_client


@pytest.fixture
async def other_browser(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with asgi_client(app, headers=SPA_HEADERS) as http_client:
        yield http_client


@pytest.fixture
async def third_browser(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """A jar of its own — `recruiter` *is* `browser`, so a second applicant needs this one."""
    async with asgi_client(app, headers=SPA_HEADERS) as http_client:
        yield http_client


@pytest.fixture
async def recruiter(browser: AsyncClient, mailbox: Mailbox) -> AsyncClient:
    """A signed-in admin of a tenant of their own."""
    await an_admin(browser, mailbox)
    return browser


@pytest.fixture
async def rival(app: FastAPI, mailbox: Mailbox) -> AsyncIterator[AsyncClient]:
    """A second Tenant, signed in, with a jar of its own — where a leak between tenants shows."""
    async with asgi_client(app, headers=SPA_HEADERS) as browser:
        await an_admin(browser, mailbox, label="rival")
        yield browser


@pytest.fixture
async def visitor(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """Nobody: no session, no cookies of anyone else's, and a jar of their own."""
    async with asgi_client(app) as http_client:
        yield http_client


@pytest.fixture(scope="session")
async def mailbox(_stack_environment: None) -> AsyncIterator[Mailbox]:
    async for inbox in mailbox_at(stack.stack_config()["MAILPIT_URL"]):
        yield inbox


@pytest.fixture(scope="session")
async def failing_client(settings: Settings) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)

    @app.get("/v1/demo/echo")
    async def echo(count: int) -> dict[str, int]:
        return {"count": count}

    @app.get("/v1/demo/boom")
    async def boom() -> dict[str, str]:
        raise RuntimeError("credentials=hunter2 leaked into the exception message")

    async with LifespanManager(app), asgi_client(app) as http_client:
        yield http_client
