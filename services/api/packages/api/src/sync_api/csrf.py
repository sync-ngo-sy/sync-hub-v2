from __future__ import annotations

from typing import Final

from fastapi import Request

from sync_api.problems import CSRF_HEADER_REQUIRED_PROBLEM_TYPE, Problem

CSRF_HEADER: Final = "X-Sync-Request"

SAFE_METHODS: Final = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


async def enforce_csrf_header(request: Request) -> None:
    if request.method in SAFE_METHODS or CSRF_HEADER in request.headers:
        return
    raise Problem(
        status=403,
        type=CSRF_HEADER_REQUIRED_PROBLEM_TYPE,
        detail=f"Requests that change data must carry the {CSRF_HEADER} header.",
    )
