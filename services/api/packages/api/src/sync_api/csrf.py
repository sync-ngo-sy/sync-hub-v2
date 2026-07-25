"""The half of the CSRF defence that cookies cannot provide on their own.

`SameSite=Lax` already keeps the session cookie off cross-site POSTs in every browser that
honours it. This is the second lock: a mutating request must also carry `X-Sync-Request`.
A form on another origin cannot add a header at all, and `fetch`/`XHR` adding one turns the
request into a preflighted cross-origin call — which the API declines, because it declares
no CORS policy whatsoever and a browser treats silence as refusal. So the header is only
ever present on a request one of our own pages made.

That last part is load-bearing, and it is load-bearing on an *absence*: the day CORS is
configured — the SPAs are same-origin through a proxy today, so nothing needs it yet —
whatever origins that allowlist names inherit the right to forge these requests, and this
lock is worth exactly as much as the allowlist is short.

Installed as an application-wide dependency rather than middleware, which is what keeps a
`POST` to a `GET`-only path answering 405 instead of 403: dependencies run after routing.
Every route the API ever grows is covered, with nothing for a future ticket to remember.
"""

from __future__ import annotations

from typing import Final

from fastapi import Request

from sync_api.problems import CSRF_HEADER_REQUIRED_PROBLEM_TYPE, Problem

#: Any value will do. Its presence is the whole signal.
CSRF_HEADER: Final = "X-Sync-Request"

#: The methods RFC 9110 calls safe, which by definition change nothing worth forging.
SAFE_METHODS: Final = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


async def enforce_csrf_header(request: Request) -> None:
    if request.method in SAFE_METHODS or CSRF_HEADER in request.headers:
        return
    raise Problem(
        status=403,
        type=CSRF_HEADER_REQUIRED_PROBLEM_TYPE,
        detail=f"Requests that change data must carry the {CSRF_HEADER} header.",
    )
