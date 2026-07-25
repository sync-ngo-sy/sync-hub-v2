"""Standing the app up in-process, for the suite's primary seam.

Tests drive the real ASGI application over httpx and assert on the response plus what the
request left in the database. Nothing here stubs anything — the only thing being arranged
is which `Settings` the app was built with.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from http.cookies import SimpleCookie
from typing import TYPE_CHECKING, Any

from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient, Response

from sync_api.app import create_app
from sync_api.csrf import CSRF_HEADER

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from fastapi import FastAPI

    from sync_core import Settings

#: Session cookies are `Secure`, so a client on `http://` would drop them silently and every
#: auth test would fail for the wrong reason. Tests speak https to keep the app's own
#: production cookie settings under test instead of relaxing them for the suite.
TEST_BASE_URL = "https://testserver"
TEST_HOST = "testserver"

#: What a browser running either SPA sends on every request.
SPA_HEADERS = {CSRF_HEADER: "1"}


@asynccontextmanager
async def asgi_client(
    app: FastAPI, *, headers: dict[str, str] | None = None
) -> AsyncGenerator[AsyncClient]:
    """An HTTP client speaking to `app` in-process.

    `raise_app_exceptions=False` because Starlette re-raises after its handler runs; without
    it, a test could never observe the 500 problem+json an unhandled error produces.
    """
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport, base_url=TEST_BASE_URL, headers=headers
    ) as http_client:
        yield http_client


@asynccontextmanager
async def spa_onto(settings: Settings, **overrides: Any) -> AsyncGenerator[AsyncClient]:
    """A browser-like client onto an app configured differently from the rest of the suite.

    For the handful of properties that only show up under a particular configuration — a
    rate limit small enough to reach, a database that cannot be connected to.
    """
    app = create_app(settings.model_copy(update=overrides))
    async with LifespanManager(app), asgi_client(app, headers=SPA_HEADERS) as http_client:
        yield http_client


def present_only(browser: AsyncClient, name: str, value: str, *, path: str = "/") -> None:
    """Make `name` the one cookie the client holds.

    Emptying the jar first is the point: httpx keeps a cookie the server set alongside one a
    test adds, and would go on sending the genuine one — so a test meaning to present a
    forgery would quietly be presenting the real thing.
    """
    browser.cookies.clear()
    browser.cookies.set(name, value, domain=TEST_HOST, path=path)


def cookie_attributes(response: Response, name: str) -> dict[str, str]:
    """A `Set-Cookie` header's attributes, which httpx's cookie jar throws away.

    `HttpOnly` and `Secure` are the security properties worth asserting on, and they only
    exist in the raw header.
    """
    for header in response.headers.get_list("set-cookie"):
        jar = SimpleCookie()
        jar.load(header)
        if name in jar:
            morsel = jar[name]
            return {"value": morsel.value, **{key: str(value) for key, value in morsel.items()}}
    raise AssertionError(f"the response sets no {name} cookie")
