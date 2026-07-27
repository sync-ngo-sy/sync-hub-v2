from __future__ import annotations

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

    def of(self, request: Request) -> Visitor:
        return Visitor(
            session_id=request.cookies.get(VISITOR_COOKIE) or token_urlsafe(SESSION_BYTES),
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
