from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Protocol
from uuid import UUID

from httpx import HTTPError
from supabase_auth.errors import AuthError

from sync_core import get_logger

if TYPE_CHECKING:
    from collections.abc import Mapping

logger = get_logger(__name__)


class InvalidAccessTokenError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    subject: UUID
    email: str | None


class ClaimsSource(Protocol):
    async def get_claims(self, jwt: str | None = ...) -> Mapping[str, Any] | None: ...


class JwtVerifier:
    def __init__(self, claims: ClaimsSource) -> None:
        self._claims = claims

    async def verify(self, token: str) -> AccessTokenClaims:
        try:
            answered = await self._claims.get_claims(jwt=token)
        except (AuthError, HTTPError, ValueError, KeyError) as exc:
            logger.info("auth.token_rejected", error=type(exc).__name__)
            raise InvalidAccessTokenError("the token did not verify") from exc
        if answered is None:
            raise InvalidAccessTokenError("the token carried no claims")
        return _claims_from(answered["claims"])


def _claims_from(claims: Mapping[str, Any]) -> AccessTokenClaims:
    try:
        subject = UUID(str(claims["sub"]))
    except (KeyError, ValueError) as exc:
        raise InvalidAccessTokenError("the token's subject is not a profile id") from exc
    email = claims.get("email")
    return AccessTokenClaims(subject=subject, email=email if isinstance(email, str) else None)
