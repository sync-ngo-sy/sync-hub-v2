"""Neither app hands out its own map once it is deployed.

The worker's schema is the sharper leak of the two: it names `X-Worker-Secret`, the header
that gates a `/drain` the internet can reach.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr

from sync_api.app import create_app as create_api
from sync_api.problems import PROBLEM_JSON_MEDIA_TYPE
from sync_core import Environment, Settings
from sync_worker.service import SECRET_HEADER
from sync_worker.service import create_app as create_worker

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Callable

    from fastapi import FastAPI

DOCUMENTATION_PATHS = ["/openapi.json", "/docs", "/redoc"]

BOTH_APPS = [
    pytest.param(create_api, id="api"),
    pytest.param(create_worker, id="worker"),
]

DEPLOYED = [Environment.STAGING, Environment.PRODUCTION]
UNDEPLOYED = [Environment.LOCAL, Environment.CI]


def settings_in(environment: Environment) -> Settings:
    # Every field explicit, environment included: pydantic-settings would otherwise read
    # SYNC_* out of the shell and decide the answer these tests are here to pin.
    return Settings(
        _env_file=None,  # pyright: ignore[reportCallIssue] — accepted at run time
        environment=environment,
        database_url="postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
        supabase_url="http://127.0.0.1:54321",
        supabase_service_role_key=SecretStr("service-role"),
        supabase_anon_key=SecretStr("anon"),
        recruiter_portal_url="http://127.0.0.1:5174",
        admin_portal_url="http://127.0.0.1:5175",
    )  # pyright: ignore[reportCallIssue, reportArgumentType]


@asynccontextmanager
async def _client(app: FastAPI) -> AsyncGenerator[AsyncClient]:
    # No lifespan: nothing that serves a schema reads the state it builds, and a unit test
    # has no database to open.
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://app") as client:
        yield client


@pytest.mark.parametrize("create_app", BOTH_APPS)
@pytest.mark.parametrize("environment", DEPLOYED)
@pytest.mark.parametrize("path", DOCUMENTATION_PATHS)
async def test_a_deployed_app_serves_no_documentation(
    create_app: Callable[[Settings], FastAPI], environment: Environment, path: str
) -> None:
    async with _client(create_app(settings_in(environment))) as client:
        response = await client.get(path)

    assert response.status_code == 404


@pytest.mark.parametrize("create_app", BOTH_APPS)
@pytest.mark.parametrize("environment", UNDEPLOYED)
@pytest.mark.parametrize("path", DOCUMENTATION_PATHS)
async def test_an_undeployed_app_keeps_its_documentation(
    create_app: Callable[[Settings], FastAPI], environment: Environment, path: str
) -> None:
    async with _client(create_app(settings_in(environment))) as client:
        response = await client.get(path)

    assert response.status_code == 200


async def test_a_deployed_worker_stops_naming_the_header_that_gates_it() -> None:
    async with _client(create_worker(settings_in(Environment.LOCAL))) as client:
        described = await client.get("/openapi.json")
    async with _client(create_worker(settings_in(Environment.PRODUCTION))) as client:
        withheld = await client.get("/openapi.json")

    assert SECRET_HEADER in described.text
    assert withheld.status_code == 404


async def test_a_deployed_schema_is_still_built_as_problem_json() -> None:
    """Withholding the schema must not quietly drop what shapes it, for whoever does build it."""
    described = create_api(settings_in(Environment.PRODUCTION)).openapi()
    responses = described["paths"]["/v1/auth/login"]["post"]["responses"]

    assert list(responses["422"]["content"]) == [PROBLEM_JSON_MEDIA_TYPE]
