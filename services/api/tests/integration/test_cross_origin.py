"""CORS against the real app, since the middleware is the thing under test.

Once the portals are static sites on their own hostnames and the API is a separate host,
every authenticated request is cross-origin. What has to hold: an allowed origin gets the
credentialed headers back, anything else gets nothing, and preflight permits the CSRF header
the API requires on writes — without which no cross-origin write can even be attempted.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from asgi_lifespan import LifespanManager

from sync_api.app import create_app
from sync_api.csrf import CSRF_HEADER
from tests.support.candidates import a_signup, confirm_email, sign_up
from tests.support.harness import asgi_client
from tests.support.mailbox import Mailbox

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from httpx import AsyncClient

    from sync_core import Settings

ALLOWED = "https://jobs.sync.ngo"
REJECTED = "https://not-ours.example"
HEALTH = "/v1/health"


@pytest.fixture
async def cross_origin(settings: Settings, _migrated_database: None) -> AsyncIterator[AsyncClient]:
    permissive = settings.model_copy(update={"cors_allowed_origins": (ALLOWED,)})
    application = create_app(permissive)
    async with LifespanManager(application), asgi_client(application) as client:
        yield client


async def test_an_allowed_origin_gets_credentialed_cors_headers(
    cross_origin: AsyncClient,
) -> None:
    response = await cross_origin.get(HEALTH, headers={"Origin": ALLOWED})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED
    # Without this the browser discards the response even though the request succeeded.
    assert response.headers["access-control-allow-credentials"] == "true"


async def test_an_origin_that_is_not_on_the_list_gets_no_cors_headers(
    cross_origin: AsyncClient,
) -> None:
    response = await cross_origin.get(HEALTH, headers={"Origin": REJECTED})

    # The request still succeeds server-side — CORS is enforced by the browser, and the point
    # is that it is given nothing to work with.
    assert "access-control-allow-origin" not in response.headers


async def test_the_origin_is_never_echoed_back_as_a_wildcard(cross_origin: AsyncClient) -> None:
    response = await cross_origin.get(HEALTH, headers={"Origin": ALLOWED})

    assert response.headers["access-control-allow-origin"] != "*"


async def test_preflight_permits_the_csrf_header_the_api_requires(
    cross_origin: AsyncClient,
) -> None:
    response = await cross_origin.request(
        "OPTIONS",
        "/v1/auth/login",
        headers={
            "Origin": ALLOWED,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": CSRF_HEADER,
        },
    )

    assert response.status_code == 200
    allowed_headers = response.headers["access-control-allow-headers"].lower()
    assert CSRF_HEADER.lower() in allowed_headers
    assert "POST" in response.headers["access-control-allow-methods"]
    assert response.headers["access-control-allow-credentials"] == "true"


async def test_preflight_from_a_rejected_origin_is_refused(cross_origin: AsyncClient) -> None:
    response = await cross_origin.request(
        "OPTIONS",
        "/v1/auth/login",
        headers={
            "Origin": REJECTED,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": CSRF_HEADER,
        },
    )

    assert "access-control-allow-origin" not in response.headers


async def test_the_session_cookie_the_api_sets_carries_no_domain(
    browser: AsyncClient, mailbox: Mailbox
) -> None:
    """Host-only in the response itself, not merely unset in configuration.

    A Domain attribute is what would let staging's cookie be sent to production's API, since
    both are subdomains of one registrable domain.
    """
    # One signup, reused: each call to a_signup mints a fresh random address, so confirming
    # against a second one waits for mail that was never sent.
    signup = a_signup("host-only")
    signed_up = await sign_up(browser, signup)
    assert signed_up.status_code == 201, signed_up.text
    confirmed = await confirm_email(browser, mailbox, signup)

    cookies = [
        value for name, value in confirmed.headers.multi_items() if name.lower() == "set-cookie"
    ]
    assert cookies, "confirming an email is expected to start a session"
    for cookie in cookies:
        assert "domain=" not in cookie.lower()
