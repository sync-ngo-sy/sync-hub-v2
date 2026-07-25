"""Where a session lives between requests.

ADR-0005 keeps the Supabase tokens in httpOnly cookies rather than anywhere JavaScript can
reach, so an XSS bug in either SPA cannot walk off with a session. The browser attaches
them; the SPAs never see them.

The two cookies have deliberately different reach. The access cookie goes to every route,
because every route may need to know who is asking. The refresh cookie goes only to
`/v1/auth`, the two endpoints that spend it — so the token that can mint new sessions is
absent from the overwhelming majority of requests, including any that a future bug logs.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final, Literal, cast

if TYPE_CHECKING:
    from fastapi import Request, Response

    from sync_api.auth.gotrue import GoTrueSession
    from sync_core import Settings

ACCESS_TOKEN_COOKIE: Final = "sync_access_token"
REFRESH_TOKEN_COOKIE: Final = "sync_refresh_token"

#: GoTrue does not say how long a refresh token lives, and rotation renews it on every use.
#: Two weeks is how long a session survives being left alone.
REFRESH_TOKEN_MAX_AGE_SECONDS: Final = 14 * 24 * 60 * 60


class SessionCookies:
    """Reads the session off a request and writes it onto a response."""

    def __init__(self, settings: Settings, *, refresh_path: str) -> None:
        self._secure = settings.auth_cookie_secure
        # `SameSite`'s members are exactly Starlette's literal; the enum is what validates it.
        self._same_site = cast("Literal['lax', 'strict', 'none']", settings.auth_cookie_same_site)
        self._domain = settings.auth_cookie_domain
        self._refresh_path = refresh_path

    def read_access_token(self, request: Request) -> str | None:
        return request.cookies.get(ACCESS_TOKEN_COOKIE) or None

    def read_refresh_token(self, request: Request) -> str | None:
        return request.cookies.get(REFRESH_TOKEN_COOKIE) or None

    def issue(self, response: Response, session: GoTrueSession) -> None:
        """Put a freshly minted session on the wire, replacing whatever was there."""
        self._set(response, ACCESS_TOKEN_COOKIE, session.access_token, "/", session.expires_in)
        self._set(
            response,
            REFRESH_TOKEN_COOKIE,
            session.refresh_token,
            self._refresh_path,
            REFRESH_TOKEN_MAX_AGE_SECONDS,
        )

    def clear(self, response: Response) -> None:
        """Expire both cookies. Safe to call when there was no session to begin with."""
        self._set(response, ACCESS_TOKEN_COOKIE, "", "/", 0)
        self._set(response, REFRESH_TOKEN_COOKIE, "", self._refresh_path, 0)

    def _set(self, response: Response, name: str, value: str, path: str, max_age: int) -> None:
        response.set_cookie(
            name,
            value,
            max_age=max_age,
            path=path,
            domain=self._domain,
            secure=self._secure,
            httponly=True,
            samesite=self._same_site,
        )
