from __future__ import annotations

import json
from base64 import urlsafe_b64decode, urlsafe_b64encode
from typing import TYPE_CHECKING, Final, Literal, cast

if TYPE_CHECKING:
    from fastapi import Request, Response

    from sync_api.auth.gotrue import GoTrueSession
    from sync_core import Settings

#: Firebase Hosting forwards exactly one cookie to a rewritten backend, and only under this name.
#: Everything else is stripped in front of the service, so a cookie called anything else never
#: arrives and every authenticated request is refused. See #273 and ADR-0016.
SESSION_COOKIE: Final = "__session"

ACCESS_TOKEN_KEY: Final = "a"
REFRESH_TOKEN_KEY: Final = "r"

REFRESH_TOKEN_MAX_AGE_SECONDS: Final = 14 * 24 * 60 * 60


def pack_session(access_token: str, refresh_token: str) -> str:
    payload = json.dumps(
        {ACCESS_TOKEN_KEY: access_token, REFRESH_TOKEN_KEY: refresh_token},
        separators=(",", ":"),
    )
    return urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def _unpack(value: str | None) -> dict[str, str]:
    if not value:
        return {}
    try:
        padded = value + "=" * (-len(value) % 4)
        decoded = json.loads(urlsafe_b64decode(padded.encode()))
    except (ValueError, TypeError):
        return {}
    if not isinstance(decoded, dict):
        return {}
    return {key: token for key, token in decoded.items() if isinstance(token, str)}


class SessionCookies:
    """Both tokens in one cookie, because only one can survive the hop through Hosting.

    The refresh token used to be scoped to the auth router so it was not sent on every request.
    One cookie cannot carry two paths, so that narrowing is gone -- recorded in #273 rather than
    lost quietly. It stays `HttpOnly` and `Secure`, so script cannot read it either way.
    """

    def __init__(self, settings: Settings, *, refresh_path: str) -> None:
        self._secure = settings.auth_cookie_secure
        self._same_site: Literal["lax", "strict", "none"] = cast(
            "Literal['lax', 'strict', 'none']", settings.auth_cookie_same_site
        )
        self._domain = settings.auth_cookie_domain
        self._refresh_path = refresh_path

    def read_access_token(self, request: Request) -> str | None:
        return _unpack(request.cookies.get(SESSION_COOKIE)).get(ACCESS_TOKEN_KEY) or None

    def read_refresh_token(self, request: Request) -> str | None:
        return _unpack(request.cookies.get(SESSION_COOKIE)).get(REFRESH_TOKEN_KEY) or None

    def issue(self, response: Response, session: GoTrueSession) -> None:
        # The cookie outlives the access token it carries. An expired access token inside a live
        # cookie is refused by the verifier, which is what drives the client to refresh -- and the
        # refresh token beside it is what makes that refresh succeed.
        self._set(
            response,
            pack_session(session.access_token, session.refresh_token),
            REFRESH_TOKEN_MAX_AGE_SECONDS,
        )

    def clear(self, response: Response) -> None:
        self._set(response, "", 0)

    def _set(self, response: Response, value: str, max_age: int) -> None:
        response.set_cookie(
            SESSION_COOKIE,
            value,
            max_age=max_age,
            path="/",
            domain=self._domain,
            secure=self._secure,
            httponly=True,
            samesite=self._same_site,
        )
