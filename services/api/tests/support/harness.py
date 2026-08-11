from __future__ import annotations

import json
from base64 import urlsafe_b64decode
from contextlib import asynccontextmanager
from http.cookies import SimpleCookie
from typing import TYPE_CHECKING, Any, cast

from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient, Response

from sync_api.app import create_app
from sync_api.csrf import CSRF_HEADER

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from fastapi import FastAPI

    from sync_core import Settings

TEST_BASE_URL = "https://testserver"
TEST_HOST = "testserver"

SPA_HEADERS = {CSRF_HEADER: "1"}

#: Which app a client speaks to, remembered on the client itself.
APP = "sync_app"


@asynccontextmanager
async def asgi_client(
    app: FastAPI, *, headers: dict[str, str] | None = None
) -> AsyncGenerator[AsyncClient]:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport, base_url=TEST_BASE_URL, headers=headers
    ) as http_client:
        setattr(http_client, APP, app)
        yield http_client


def app_of(browser: AsyncClient) -> FastAPI:
    """The app behind a client, for the little that test setup has to do past HTTP.

    Opening a Tenant is a Platform admin's operation now, so a test that just needs a Tenant to
    exist reaches the service directly rather than signing an operator in first.
    """
    return cast("FastAPI", getattr(browser, APP))


@asynccontextmanager
async def spa_onto(settings: Settings, **overrides: Any) -> AsyncGenerator[AsyncClient]:
    app = create_app(settings.model_copy(update=overrides))
    async with LifespanManager(app), asgi_client(app, headers=SPA_HEADERS) as http_client:
        yield http_client


def present_only(browser: AsyncClient, name: str, value: str, *, path: str = "/") -> None:
    browser.cookies.clear()
    browser.cookies.set(name, value, domain=TEST_HOST, path=path)


def cookie_attributes(response: Response, name: str) -> dict[str, str]:
    for header in response.headers.get_list("set-cookie"):
        jar = SimpleCookie()
        jar.load(header)
        if name in jar:
            morsel = jar[name]
            return {"value": morsel.value, **{key: str(value) for key, value in morsel.items()}}
    raise AssertionError(f"the response sets no {name} cookie")


def session_tokens(value: str) -> dict[str, str]:
    """Unpack the one cookie Firebase Hosting forwards, so a test can assert on either token."""
    padded = value + "=" * (-len(value) % 4)
    return json.loads(urlsafe_b64decode(padded.encode()))
