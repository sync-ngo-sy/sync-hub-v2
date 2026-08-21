from __future__ import annotations

from math import ceil
from time import time
from typing import TYPE_CHECKING, Annotated, NamedTuple, cast

from fastapi import Depends, Request
from limits import RateLimitItemPerSecond
from limits.aio.storage import MemoryStorage
from limits.aio.strategies import MovingWindowRateLimiter

from sync_api.dependencies import ActingCandidateDep, ActingRecruiterDep, CurrentProfileDep
from sync_api.problems import RATE_LIMITED_PROBLEM_TYPE, Problem

if TYPE_CHECKING:
    from sync_core import Settings

MINIMUM_RETRY_AFTER_SECONDS = 1

DAILY_WINDOW_SECONDS = 86400.0


class Budget(NamedTuple):
    max_requests: int
    window_seconds: float


class RateLimiter:
    def __init__(self, fast: Budget, daily: Budget | None = None) -> None:
        self._limits = tuple(
            RateLimitItemPerSecond(budget.max_requests, int(budget.window_seconds))
            for budget in (fast, daily)
            if budget is not None
        )
        self._window = MovingWindowRateLimiter(MemoryStorage())

    async def consume(self, endpoint: str, caller: str) -> float | None:
        """The fast budget is spent first, so a request it has already refused never reaches the
        day's — a caller who retries into a 429 would otherwise burn the day on answers nobody
        gave them."""
        for limit in self._limits:
            if await self._window.hit(limit, endpoint, caller):
                continue
            stats = await self._window.get_window_stats(limit, endpoint, caller)
            return stats.reset_time - time()
        return None


def build_auth_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.auth_rate_limit_max_requests,
        settings.auth_rate_limit_window_seconds,
    )


def build_public_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.public_rate_limit_max_requests,
        settings.public_rate_limit_window_seconds,
    )


def build_access_request_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.access_request_rate_limit_max_requests,
        settings.access_request_rate_limit_window_seconds,
    )


def build_assessment_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.assessment_rate_limit_max_requests,
        settings.assessment_rate_limit_window_seconds,
    )


def build_directory_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.directory_rate_limit_max_requests,
        settings.directory_rate_limit_window_seconds,
        settings.directory_rate_limit_daily_max_requests,
    )


def build_candidate_record_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.candidate_record_rate_limit_max_requests,
        settings.candidate_record_rate_limit_window_seconds,
        settings.candidate_record_rate_limit_daily_max_requests,
    )


def build_search_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.search_rate_limit_max_requests,
        settings.search_rate_limit_window_seconds,
        settings.search_rate_limit_daily_max_requests,
    )


def build_cv_upload_rate_limiter(settings: Settings) -> RateLimiter:
    return _budgeted(
        settings.cv_upload_rate_limit_max_requests,
        settings.cv_upload_rate_limit_window_seconds,
        settings.cv_upload_rate_limit_daily_max_requests,
    )


def _budgeted(
    max_requests: int, window_seconds: float, daily_max_requests: int | None = None
) -> RateLimiter:
    fast = Budget(max_requests=max_requests, window_seconds=window_seconds)
    if daily_max_requests is None:
        return RateLimiter(fast)
    return RateLimiter(
        fast, Budget(max_requests=daily_max_requests, window_seconds=DAILY_WINDOW_SECONDS)
    )


def get_auth_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.auth_rate_limiter)


def get_public_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.public_rate_limiter)


def get_access_request_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.access_request_rate_limiter)


def get_assessment_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.assessment_rate_limiter)


def get_directory_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.directory_rate_limiter)


def get_candidate_record_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.candidate_record_rate_limiter)


def get_search_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.search_rate_limiter)


def get_cv_upload_rate_limiter(request: Request) -> RateLimiter:
    return cast("RateLimiter", request.app.state.cv_upload_rate_limiter)


async def enforce_auth_rate_limit(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_auth_rate_limiter)]
) -> None:
    await _enforce(limiter, request)


async def enforce_public_rate_limit(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_public_rate_limiter)]
) -> None:
    """Blunts scraping of the one surface with no account behind it."""
    await _enforce(limiter, request)


async def enforce_access_request_rate_limit(
    request: Request, limiter: Annotated[RateLimiter, Depends(get_access_request_rate_limiter)]
) -> None:
    """The only unauthenticated write on the platform, and the only thing standing between the
    Platform admin's queue and a script."""
    await _enforce(limiter, request)


async def enforce_password_change_rate_limit(
    request: Request,
    profile: CurrentProfileDep,
    limiter: Annotated[RateLimiter, Depends(get_auth_rate_limiter)],
) -> None:
    """Spent per account rather than per address: the budget that matters here belongs to the
    account being guessed at, not to whichever address the guessing arrives from."""
    await _enforce(limiter, request, caller=str(profile.id))


async def enforce_assessment_rate_limit(
    request: Request,
    recruiter: ActingRecruiterDep,
    limiter: Annotated[RateLimiter, Depends(get_assessment_rate_limiter)],
) -> None:
    """Keeps one Tenant from spending the model budget of every other one."""
    await _enforce(limiter, request, caller=str(recruiter.tenant.id))


async def enforce_directory_rate_limit(
    request: Request,
    recruiter: ActingRecruiterDep,
    limiter: Annotated[RateLimiter, Depends(get_directory_rate_limiter)],
) -> None:
    """Per Tenant, because the whole contact database is reachable by paging this one route and
    a Tenant's recruiters page it together."""
    await _enforce(limiter, request, caller=str(recruiter.tenant.id))


async def enforce_candidate_record_rate_limit(
    request: Request,
    recruiter: ActingRecruiterDep,
    limiter: Annotated[RateLimiter, Depends(get_candidate_record_rate_limiter)],
) -> None:
    """The tightest budget of the four, because this is the only way to turn a directory listing
    into an email address and a phone number, so a Tenant's day of them is what a scrape has to
    fit inside. An Application already carries the contact details of whoever sent it; reaching
    a Candidate who never applied goes through here."""
    await _enforce(limiter, request, caller=str(recruiter.tenant.id))


async def enforce_search_rate_limit(
    request: Request,
    recruiter: ActingRecruiterDep,
    limiter: Annotated[RateLimiter, Depends(get_search_rate_limiter)],
) -> None:
    """Every search embeds its question, so this is model spend as well as discovery — counted
    per Tenant on both grounds."""
    await _enforce(limiter, request, caller=str(recruiter.tenant.id))


async def enforce_cv_upload_rate_limit(
    request: Request,
    candidate: ActingCandidateDep,
    limiter: Annotated[RateLimiter, Depends(get_cv_upload_rate_limiter)],
) -> None:
    """Per acting profile: every upload queues a parse the platform pays a model for, and the
    account that asked for it is the one that spends."""
    await _enforce(limiter, request, caller=str(candidate.id))


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
