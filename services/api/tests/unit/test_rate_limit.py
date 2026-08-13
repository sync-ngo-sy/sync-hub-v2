"""The rate limiter's store is the boundary a shared quota is enforced across.

The defect this covers: each limiter used to build its own in-memory store, so the real quota
was the configured value times the number of running processes and grew as the deployment
scaled out. One shared store is what makes a limit mean the same thing across the fleet.
"""

from __future__ import annotations

import pytest
from limits.aio.storage import MemoryStorage
from pydantic import SecretStr, ValidationError

from sync_api.rate_limit import RateLimiter, build_rate_limit_storage
from sync_core import Settings
from sync_core.settings import Environment

REQUIRED = {
    "database_url": "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres",
    "supabase_url": "http://127.0.0.1:54321",
    "supabase_service_role_key": SecretStr("service-role"),
    "supabase_anon_key": SecretStr("anon"),
    "recruiter_portal_url": "http://127.0.0.1:5174",
    "admin_portal_url": "http://127.0.0.1:5175",
}

A_TIGHT_LIMIT = 3
ENDPOINT = "/v1/anything"
CALLER = "203.0.113.7"


def settings_with(**overrides: object) -> Settings:
    return Settings(_env_file=None, **REQUIRED, **overrides)  # pyright: ignore[reportCallIssue, reportArgumentType]


def a_limiter(storage: MemoryStorage) -> RateLimiter:
    return RateLimiter(storage, max_requests=A_TIGHT_LIMIT, window_seconds=60)


async def test_two_instances_on_one_store_enforce_a_single_window() -> None:
    store = MemoryStorage()
    first, second = a_limiter(store), a_limiter(store)

    allowed = 0
    for limiter in (first, second, first, second, first, second):
        if await limiter.consume(ENDPOINT, CALLER) is None:
            allowed += 1

    assert allowed == A_TIGHT_LIMIT, "the two instances shared one budget, not one each"


async def test_separate_stores_do_not_share_a_window() -> None:
    """The contrast that names the boundary: split the store and the quota multiplies — which is
    exactly the per-process behaviour the shared store replaces."""
    first, second = a_limiter(MemoryStorage()), a_limiter(MemoryStorage())

    allowed = 0
    for limiter in (first, second, first, second, first, second):
        if await limiter.consume(ENDPOINT, CALLER) is None:
            allowed += 1

    assert allowed == A_TIGHT_LIMIT * 2


async def test_a_blocked_call_reports_a_positive_retry_after() -> None:
    store = MemoryStorage()
    limiter = a_limiter(store)
    for _ in range(A_TIGHT_LIMIT):
        assert await limiter.consume(ENDPOINT, CALLER) is None

    retry_after = await limiter.consume(ENDPOINT, CALLER)

    assert retry_after is not None
    assert retry_after > 0


async def test_different_callers_have_independent_budgets() -> None:
    store = MemoryStorage()
    limiter = a_limiter(store)
    for _ in range(A_TIGHT_LIMIT):
        assert await limiter.consume(ENDPOINT, CALLER) is None

    assert await limiter.consume(ENDPOINT, "198.51.100.42") is None


def test_the_default_store_is_an_async_memory_store() -> None:
    storage = build_rate_limit_storage(settings_with())

    assert isinstance(storage, MemoryStorage)


def test_a_synchronous_store_uri_is_refused() -> None:
    """Without the `async+` scheme the limiter would only fail at the first awaited request."""
    with pytest.raises(TypeError, match="async"):
        build_rate_limit_storage(settings_with(rate_limit_storage_uri="memory://"))


def test_a_deployed_environment_refuses_the_in_memory_store() -> None:
    """The silent multiplier: an autoscaled deployment on memory keeps one window per instance."""
    for deployed in (Environment.STAGING, Environment.PRODUCTION):
        with pytest.raises(ValidationError, match="shared store"):
            settings_with(environment=deployed, rate_limit_storage_uri="async+memory://")


def test_a_deployed_environment_accepts_a_shared_store() -> None:
    deployed = settings_with(
        environment=Environment.PRODUCTION,
        rate_limit_storage_uri="async+redis://cache:6379/0",
    )

    assert deployed.rate_limit_storage_uri.startswith("async+redis")


def test_local_keeps_the_in_memory_default() -> None:
    assert settings_with().rate_limit_storage_uri == "async+memory://"
