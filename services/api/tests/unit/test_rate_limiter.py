from __future__ import annotations

from asyncio import sleep

from sync_api.rate_limit import Budget, RateLimiter

A_MOMENT = 1.0
A_MINUTE = 60.0
A_DAY = 86400.0

AN_ENDPOINT = "/v1/directory/candidates"


async def test_a_request_under_every_budget_is_let_through() -> None:
    limiter = RateLimiter(Budget(max_requests=2, window_seconds=A_MINUTE))

    assert await limiter.consume(AN_ENDPOINT, "acme") is None


async def test_the_fast_budget_refuses_a_burst() -> None:
    limiter = RateLimiter(Budget(max_requests=1, window_seconds=A_MINUTE))

    await limiter.consume(AN_ENDPOINT, "acme")
    retry_after = await limiter.consume(AN_ENDPOINT, "acme")

    assert retry_after is not None
    assert 0 < retry_after <= A_MINUTE


async def test_the_daily_budget_refuses_a_caller_the_fast_one_would_admit() -> None:
    limiter = RateLimiter(
        Budget(max_requests=100, window_seconds=A_MINUTE),
        Budget(max_requests=1, window_seconds=A_DAY),
    )

    await limiter.consume(AN_ENDPOINT, "acme")
    retry_after = await limiter.consume(AN_ENDPOINT, "acme")

    assert retry_after is not None
    assert retry_after > A_MINUTE


async def test_a_burst_the_fast_budget_refuses_does_not_spend_the_day() -> None:
    limiter = RateLimiter(
        Budget(max_requests=1, window_seconds=A_MOMENT),
        Budget(max_requests=2, window_seconds=A_DAY),
    )

    assert await limiter.consume(AN_ENDPOINT, "acme") is None
    for _ in range(10):
        assert await limiter.consume(AN_ENDPOINT, "acme") is not None

    await sleep(A_MOMENT + 0.1)

    assert await limiter.consume(AN_ENDPOINT, "acme") is None
    assert await limiter.consume(AN_ENDPOINT, "acme") is not None


async def test_each_caller_has_a_budget_of_their_own() -> None:
    limiter = RateLimiter(Budget(max_requests=1, window_seconds=A_MINUTE))

    await limiter.consume(AN_ENDPOINT, "acme")

    assert await limiter.consume(AN_ENDPOINT, "rival") is None


async def test_each_endpoint_has_a_budget_of_its_own() -> None:
    limiter = RateLimiter(Budget(max_requests=1, window_seconds=A_MINUTE))

    await limiter.consume(AN_ENDPOINT, "acme")

    assert await limiter.consume("/v1/search/candidates", "acme") is None
