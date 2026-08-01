from __future__ import annotations

from httpx import AsyncClient

from sync_api.csrf import CSRF_HEADER
from sync_core import Settings
from tests.support.candidates import a_signup, sign_in, sign_up
from tests.support.harness import spa_onto

A_TIGHT_LIMIT = 2


async def test_a_mutating_request_without_the_csrf_header_is_refused(client: AsyncClient) -> None:
    response = await client.post("/v1/auth/login", json={"email": "a@b.com", "password": "x" * 8})

    assert response.status_code == 403
    assert response.json()["type"] == "urn:sync:problem:csrf-header-required"


async def test_a_safe_request_does_not_need_the_csrf_header(client: AsyncClient) -> None:
    assert (await client.get("/v1/health")).status_code == 200


async def test_the_csrf_guard_does_not_swallow_a_wrong_method(client: AsyncClient) -> None:
    assert (await client.post("/v1/health")).status_code == 405


async def test_the_csrf_header_lets_a_mutating_request_through(browser: AsyncClient) -> None:
    response = await sign_in(browser, a_signup())

    assert response.headers.get("content-type", "").startswith("application/problem+json")
    assert response.status_code == 401, "rejected on credentials, not on CSRF"


async def test_repeated_sign_in_attempts_are_rate_limited(settings: Settings) -> None:
    signup = a_signup()

    async with spa_onto(settings, auth_rate_limit_max_requests=A_TIGHT_LIMIT) as spa:
        for _ in range(A_TIGHT_LIMIT):
            assert (await sign_in(spa, signup)).status_code == 401

        response = await sign_in(spa, signup)

    assert response.status_code == 429
    assert response.json()["type"] == "urn:sync:problem:rate-limited"
    assert int(response.headers["Retry-After"]) >= 1


async def test_the_rate_limit_is_counted_per_endpoint(settings: Settings) -> None:
    signup = a_signup()

    async with spa_onto(settings, auth_rate_limit_max_requests=A_TIGHT_LIMIT) as spa:
        for _ in range(A_TIGHT_LIMIT + 1):
            await sign_in(spa, signup)

        assert (await sign_up(spa, signup)).status_code == 201


async def test_logging_out_is_rate_limited_too(settings: Settings) -> None:
    async with spa_onto(settings, auth_rate_limit_max_requests=A_TIGHT_LIMIT) as spa:
        for _ in range(A_TIGHT_LIMIT):
            assert (await spa.post("/v1/auth/logout")).status_code == 204

        assert (await spa.post("/v1/auth/logout")).status_code == 429


async def test_reading_the_current_profile_is_not_rate_limited(settings: Settings) -> None:
    async with spa_onto(settings, auth_rate_limit_max_requests=A_TIGHT_LIMIT) as spa:
        answered = [await spa.get("/v1/auth/me") for _ in range(A_TIGHT_LIMIT + 2)]

    assert answered[-1].status_code == 401


async def test_the_csrf_header_is_documented_where_a_client_generator_will_find_it(
    client: AsyncClient,
) -> None:
    schema = (await client.get("/openapi.json")).json()

    assert CSRF_HEADER in schema["info"]["description"]
