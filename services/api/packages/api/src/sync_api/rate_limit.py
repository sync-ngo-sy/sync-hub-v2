"""Blunting credential stuffing on the auth endpoints.

The counting is `limits` — the library `slowapi` and `flask-limiter` are both built on —
with its in-memory storage and a moving-window strategy. Moving rather than fixed: a fixed
window lets a caller spend the whole allowance at the end of one window and the whole of
the next allowance immediately after, so the real worst case is twice the number the
setting appears to promise.

`slowapi` itself would be the FastAPI-shaped choice, but it wants a decorator on each route
and answers with its own JSON error; we already have a dependency and one problem+json
convention, so this uses the primitive underneath it instead.

In-memory means per-replica. That is a real limit and a deliberate one: a shared counter
needs Redis, which the walking skeleton does not have, and an attacker forced to spread an
attack across every replica has already lost most of the throughput they wanted.

What this does *not* do is limit attempts per account. GoTrue's own limits count per client
address as well, so a botnet grinding one candidate's password from many addresses is
throttled by neither. Fixing that means a per-identity counter, which brings its own hazard
— an attacker can then lock a victim out by exhausting it — and a decision this ticket does
not make. Recorded here so the gap is a known one.
"""

from __future__ import annotations

from math import ceil
from time import time
from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request
from limits import RateLimitItemPerSecond
from limits.aio.storage import MemoryStorage
from limits.aio.strategies import MovingWindowRateLimiter

from sync_api.problems import RATE_LIMITED_PROBLEM_TYPE, Problem

if TYPE_CHECKING:
    from sync_core import Settings

#: What a caller is told to wait when the window is somehow already clear. `limits` reports
#: the reset time of the window it just refused, so this is a floor, not the usual answer.
MINIMUM_RETRY_AFTER_SECONDS = 1


class AuthRateLimiter:
    """How many attempts one caller gets at one auth endpoint, and how long until more."""

    def __init__(self, *, max_requests: int, window_seconds: float) -> None:
        self._limit = RateLimitItemPerSecond(max_requests, int(window_seconds))
        self._window = MovingWindowRateLimiter(MemoryStorage())

    async def consume(self, endpoint: str, caller: str) -> float | None:
        """Record an attempt. Returns the seconds to wait if the caller is over their limit."""
        if await self._window.hit(self._limit, endpoint, caller):
            return None
        stats = await self._window.get_window_stats(self._limit, endpoint, caller)
        return stats.reset_time - time()


def build_auth_rate_limiter(settings: Settings) -> AuthRateLimiter:
    return AuthRateLimiter(
        max_requests=settings.auth_rate_limit_max_requests,
        window_seconds=settings.auth_rate_limit_window_seconds,
    )


def get_auth_rate_limiter(request: Request) -> AuthRateLimiter:
    return cast("AuthRateLimiter", request.app.state.auth_rate_limiter)


async def enforce_auth_rate_limit(
    request: Request, limiter: Annotated[AuthRateLimiter, Depends(get_auth_rate_limiter)]
) -> None:
    """Limit one auth endpoint for one caller. Attach to the routes worth protecting.

    Per endpoint, not per caller overall: signing in, refreshing and asking for a password
    reset are different enough that spending one should not use up the others.
    """
    retry_after = await limiter.consume(request.scope["path"], caller_of(request))
    if retry_after is None:
        return
    raise Problem(
        status=429,
        type=RATE_LIMITED_PROBLEM_TYPE,
        detail="Too many attempts. Wait a moment and try again.",
        headers={"Retry-After": str(max(MINIMUM_RETRY_AFTER_SECONDS, ceil(retry_after)))},
    )


def caller_of(request: Request) -> str:
    """Who to count against.

    The peer address, which behind a load balancer means running uvicorn with
    `--proxy-headers` so it is the client's and not the balancer's — otherwise every caller
    shares one bucket and the limit becomes a global one.
    """
    return request.client.host if request.client else "unknown"
