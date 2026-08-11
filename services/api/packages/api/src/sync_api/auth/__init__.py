from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from httpx import AsyncClient

from sync_api.auth.cookies import SESSION_COOKIE, SessionCookies, pack_session
from sync_api.auth.gotrue import GoTrue, sdk_client
from sync_api.auth.service import ActingProfile, AuthService, SignedIn
from sync_api.auth.tokens import JwtVerifier

if TYPE_CHECKING:
    from sync_core import Settings

GOTRUE_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True, slots=True)
class Authentication:
    gotrue: GoTrue
    verifier: JwtVerifier
    cookies: SessionCookies
    http: AsyncClient

    @classmethod
    def build(cls, settings: Settings, *, refresh_cookie_path: str) -> Authentication:
        http = AsyncClient(timeout=GOTRUE_TIMEOUT_SECONDS)
        anon_key = settings.supabase_anon_key.get_secret_value()
        return cls(
            gotrue=GoTrue(
                http,
                url=settings.gotrue_url,
                service_role_key=settings.supabase_service_role_key.get_secret_value(),
                anon_key=anon_key,
            ),
            verifier=JwtVerifier(sdk_client(http, url=settings.gotrue_url, key=anon_key)),
            cookies=SessionCookies(settings, refresh_path=refresh_cookie_path),
            http=http,
        )

    async def aclose(self) -> None:
        await self.http.aclose()


__all__ = [
    "SESSION_COOKIE",
    "ActingProfile",
    "AuthService",
    "Authentication",
    "GoTrue",
    "JwtVerifier",
    "SessionCookies",
    "SignedIn",
    "pack_session",
]
