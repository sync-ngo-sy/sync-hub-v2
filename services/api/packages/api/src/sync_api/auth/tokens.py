"""Turning a verified access token into the identity the API acts on.

The verification itself is the SDK's: `get_claims()` checks an asymmetric token against the
JWKS it caches on the client, and falls back to GoTrue for a legacy symmetric one. What is
here is only the adapter around it — the two claims the API acts on, and the single error
every refusal becomes, so no caller has to know how a token failed.
"""

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
    """The token is absent, malformed, expired, or not signed by GoTrue."""


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    """The parts of a verified token the API acts on."""

    #: `auth.users.id`, which the shared-PK identity makes `profiles.id` as well.
    subject: UUID
    email: str | None


class ClaimsSource(Protocol):
    """The one SDK call this module makes, and the seam the tests replace."""

    async def get_claims(self, jwt: str | None = ...) -> Mapping[str, Any] | None: ...


class JwtVerifier:
    """Verifies access tokens through the Supabase SDK."""

    def __init__(self, claims: ClaimsSource) -> None:
        self._claims = claims

    async def verify(self, token: str) -> AccessTokenClaims:
        """Return the claims of a valid token, or raise `InvalidAccessTokenError`."""
        try:
            answered = await self._claims.get_claims(jwt=token)
        except (AuthError, HTTPError, ValueError, KeyError) as exc:
            # Wider than the SDK's own errors: a token it cannot parse surfaces as a
            # pydantic or lookup failure, and every one of them is still just a bad token.
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
