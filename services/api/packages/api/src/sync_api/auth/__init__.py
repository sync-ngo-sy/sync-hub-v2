"""API-proxied authentication (ADR-0005).

`Authentication` is what the application assembles once and hands to every request;
`AuthService` is what a request actually calls.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from httpx import AsyncClient

from sync_api.auth.cookies import ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SessionCookies
from sync_api.auth.gotrue import GoTrue
from sync_api.auth.service import ActingProfile, AuthService, SignedIn
from sync_api.auth.tokens import JwtVerifier

if TYPE_CHECKING:
    from sync_core import Settings

#: How long to wait on GoTrue before giving up and answering 502. Long enough for a slow
#: password hash, short enough that a stalled identity provider cannot exhaust the workers.
GOTRUE_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True, slots=True)
class Authentication:
    """The auth machinery that outlives a request: one HTTP client, one key cache."""

    gotrue: GoTrue
    verifier: JwtVerifier
    cookies: SessionCookies
    http: AsyncClient

    @classmethod
    def build(cls, settings: Settings, *, refresh_cookie_path: str) -> Authentication:
        http = AsyncClient(timeout=GOTRUE_TIMEOUT_SECONDS)
        return cls(
            gotrue=GoTrue(
                http,
                url=settings.gotrue_url,
                service_role_key=settings.supabase_service_role_key.get_secret_value(),
                anon_key=settings.supabase_anon_key.get_secret_value(),
            ),
            verifier=JwtVerifier(
                issuer=settings.gotrue_url,
                cache_seconds=settings.auth_jwks_cache_seconds,
            ),
            cookies=SessionCookies(settings, refresh_path=refresh_cookie_path),
            http=http,
        )

    async def aclose(self) -> None:
        await self.http.aclose()


__all__ = [
    "ACCESS_TOKEN_COOKIE",
    "REFRESH_TOKEN_COOKIE",
    "ActingProfile",
    "AuthService",
    "Authentication",
    "GoTrue",
    "JwtVerifier",
    "SessionCookies",
    "SignedIn",
]
