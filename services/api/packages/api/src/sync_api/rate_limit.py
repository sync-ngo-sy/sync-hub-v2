"""Blunting credential stuffing on the auth endpoints.

A sliding window per (endpoint, caller), held in this process. Deliberately not shared
across replicas: a limiter in Redis is a dependency the walking skeleton does not have, and
an attacker who has to spread an attack across every replica to keep it up has already lost
most of the throughput the attack needed.

What this does *not* do is limit attempts per account. GoTrue's own limits count per client
address as well, so a botnet grinding one candidate's password from many addresses is
throttled by neither. Fixing that means a per-identity counter, which brings its own hazard
— an attacker can then lock a victim out by exhausting it — and a decision this ticket does
not make. Recorded here so the gap is a known one.

Sliding rather than fixed-window: a fixed window lets a caller spend the whole allowance at
the end of one window and the whole of the next allowance immediately after, so the real
worst case is twice the number the setting appears to promise.
"""

from __future__ import annotations

from collections import defaultdict, deque
from math import ceil
from time import monotonic
from typing import TYPE_CHECKING, Annotated, Final, cast

from fastapi import Depends, Request

from sync_api.problems import RATE_LIMITED_PROBLEM_TYPE, Problem

if TYPE_CHECKING:
    from sync_core import Settings

#: Keys that have not been seen for a full window hold nothing but expired timestamps, and
#: are dropped once the table is this big — so an attacker rotating addresses grows memory
#: for one window, not forever.
MAX_TRACKED_KEYS: Final = 10_000


class RateLimiter:
    """Counts recent attempts per key and says when there have been too many."""

    def __init__(self, *, max_requests: int, window_seconds: float) -> None:
        self._max_requests = max_requests
        self._window = window_seconds
        self._attempts: defaultdict[str, deque[float]] = defaultdict(deque)

    def consume(self, key: str) -> float | None:
        """Record an attempt. Returns the seconds to wait if the key is over its limit."""
        now = monotonic()
        if len(self._attempts) >= MAX_TRACKED_KEYS:
            self._sweep(now)

        recent = self._attempts[key]
        while recent and now - recent[0] >= self._window:
            recent.popleft()

        if len(recent) >= self._max_requests:
            return self._window - (now - recent[0])

        recent.append(now)
        return None

    def _sweep(self, now: float) -> None:
        for key, recent in list(self._attempts.items()):
            if not recent or now - recent[-1] >= self._window:
                del self._attempts[key]


def build_auth_rate_limiter(settings: Settings) -> RateLimiter:
    return RateLimiter(
        max_requests=settings.auth_rate_limit_max_requests,
        window_seconds=settings.auth_rate_limit_window_seconds,
    )


def get_auth_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.auth_rate_limiter)


async def enforce_auth_rate_limit(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_auth_rate_limiter)]
) -> None:
    """Limit one auth endpoint for one caller. Attach to the routes worth protecting.

    Per endpoint, not per caller overall: signing in, refreshing and asking for a password
    reset are different enough that spending one should not use up the others.
    """
    retry_after = limiter.consume(f"{request.scope['path']}|{caller_of(request)}")
    if retry_after is None:
        return
    raise Problem(
        status=429,
        type=RATE_LIMITED_PROBLEM_TYPE,
        detail="Too many attempts. Wait a moment and try again.",
        headers={"Retry-After": str(max(1, ceil(retry_after)))},
    )


def caller_of(request: Request) -> str:
    """Who to count against.

    The peer address, which behind a load balancer means running uvicorn with
    `--proxy-headers` so it is the client's and not the balancer's — otherwise every caller
    shares one bucket and the limit becomes a global one.
    """
    return request.client.host if request.client else "unknown"
