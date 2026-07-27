from __future__ import annotations

import re
from dataclasses import dataclass
from hashlib import sha256
from secrets import token_urlsafe
from typing import TYPE_CHECKING, Final, Literal, cast

if TYPE_CHECKING:
    from fastapi import Request, Response

    from sync_core import Settings

VISITOR_COOKIE: Final = "sync_visitor"

VISITOR_COOKIE_MAX_AGE_SECONDS: Final = 180 * 24 * 60 * 60

SESSION_BYTES: Final = 16

#: What `token_urlsafe(SESSION_BYTES)` produces, and the only thing read back out of the cookie.
SESSION_ID: Final = re.compile(r"^[A-Za-z0-9_-]{22}$")


@dataclass(frozen=True, slots=True)
class Visitor:
    """Who a Job view is attributed to, without anything that identifies a person."""

    session_id: str
    visitor_hash: str


class Visitors:
    """Recognizes a returning visitor without ever storing what it recognized them by.

    The session id is the platform's own cookie, so it says "the same browser came back" and
    nothing else. The hash is salted, one-way, and computed per deployment — it groups a
    stranger's views together without leaving their address in the analytics table.
    """

    def __init__(self, settings: Settings) -> None:
        self._salt = settings.visitor_hash_secret
        self._secure = settings.auth_cookie_secure
        self._same_site = cast("Literal['lax', 'strict', 'none']", settings.auth_cookie_same_site)
        self._domain = settings.auth_cookie_domain

    def recognize(self, request: Request) -> Visitor:
        return Visitor(
            session_id=_session_id(request.cookies.get(VISITOR_COOKIE)),
            visitor_hash=self._fingerprint(request),
        )

    def remember(self, response: Response, visitor: Visitor) -> None:
        response.set_cookie(
            VISITOR_COOKIE,
            visitor.session_id,
            max_age=VISITOR_COOKIE_MAX_AGE_SECONDS,
            path="/",
            domain=self._domain,
            secure=self._secure,
            httponly=True,
            samesite=self._same_site,
        )

    def _fingerprint(self, request: Request) -> str:
        address = request.client.host if request.client else ""
        agent = request.headers.get("user-agent", "")
        return sha256(f"{self._salt}|{address}|{agent}".encode()).hexdigest()


def _session_id(cookie: str | None) -> str:
    """Anything but a cookie this API issued starts a new session: the column is analytics, and
    a visitor is free to type whatever they like into their own cookie jar."""
    return (
        cookie if cookie is not None and SESSION_ID.match(cookie) else token_urlsafe(SESSION_BYTES)
    )
