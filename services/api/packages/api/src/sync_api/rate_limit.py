from __future__ import annotations

from math import ceil
from time import time
from typing import TYPE_CHECKING, Annotated, cast

from fastapi import Depends, Request
from limits import RateLimitItemPerSecond
from limits.aio.storage import MemoryStorage
from limits.aio.strategies import MovingWindowRateLimiter

from sync_api.dependencies import ActingRecruiterDep
from sync_api.problems import RATE_LIMITED_PROBLEM_TYPE, Problem

if TYPE_CHECKING:
    from sync_core import Settings

MINIMUM_RETRY_AFTER_SECONDS = 1


class RateLimiter:
    def __init__(self, *, max_requests: int, window_seconds: float) -> None:
        self._limit = RateLimitItemPerSecond(max_requests, int(window_seconds))
        self._window = MovingWindowRateLimiter(MemoryStorage())

    async def consume(self, endpoint: str, caller: str) -> float | None:
        if await self._window.hit(self._limit, endpoint, caller):
            return None
        stats = await self._window.get_window_stats(self._limit, endpoint, caller)
        return stats.reset_time - time()


def build_auth_rate_limiter(settings: Settings) -> RateLimiter:
    return RateLimiter(
        max_requests=settings.auth_rate_limit_max_requests,
        window_seconds=settings.auth_rate_limit_window_seconds,
    )


def build_public_rate_limiter(settings: Settings) -> RateLimiter:
    return RateLimiter(
        max_requests=settings.public_rate_limit_max_requests,
        window_seconds=settings.public_rate_limit_window_seconds,
    )


def build_assessment_rate_limiter(settings: Settings) -> RateLimiter:
    return RateLimiter(
        max_requests=settings.assessment_rate_limit_max_requests,
        window_seconds=settings.assessment_rate_limit_window_seconds,
    )


def get_auth_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.auth_rate_limiter)


def get_public_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.public_rate_limiter)


def get_assessment_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.assessment_rate_limiter)


async def enforce_auth_rate_limit(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_auth_rate_limiter)]
) -> None:
    await _enforce(limiter, request)


async def enforce_public_rate_limit(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_public_rate_limiter)]
) -> None:
    """Blunts scraping of the one surface with no account behind it."""
    await _enforce(limiter, request)


async def enforce_assessment_rate_limit(
    request: Request,
    recruiter: ActingRecruiterDep,
    limiter: Annotated[RateLimiter, Depends(get_assessment_rate_limiter)],
) -> None:
    """Keeps one Tenant from spending the model budget of every other one."""
    await _enforce(limiter, request, caller=str(recruiter.tenant.id))


async def _enforce(limiter: RateLimiter, request: Request, *, caller: str | None = None) -> None:
    retry_after = await limiter.consume(endpoint_of(request), caller or caller_of(request))
    if retry_after is None:
        return
    raise Problem(
        status=429,
        type=RATE_LIMITED_PROBLEM_TYPE,
        detail="Too many attempts. Wait a moment and try again.",
        headers={"Retry-After": str(max(MINIMUM_RETRY_AFTER_SECONDS, ceil(retry_after)))},
    )


def caller_of(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def endpoint_of(request: Request) -> str:
    """The route's pattern, so reading a thousand jobs is a thousand hits on one budget."""
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    return path if isinstance(path, str) else cast("str", request.scope["path"])
