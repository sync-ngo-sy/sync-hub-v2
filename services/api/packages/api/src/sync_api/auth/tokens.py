"""Verifying an access token without asking anyone.

ADR-0005 puts a JWT check on every request, so it cannot cost a network hop. GoTrue signs
with an asymmetric key and publishes the public half at `/.well-known/jwks.json`; PyJWT's
`PyJWKClient` reads that document, caches it, looks the key up by `kid`, and refetches when
a token names one it has not seen — so key rotation needs no restart. None of that is ours
to write.

What *is* ours is the policy around it, and it is the whole reason this module is not one
call to `supabase-py`'s `client.auth.get_claims()`:

- **Only asymmetric algorithms are accepted.** `get_claims` treats an HS256 token as a
  special case and validates it by calling GoTrue over the network — and a Supabase project
  keeps a legacy shared HS256 secret that GoTrue still honours. Probed against this repo's
  own stack, a token forged with that secret and *no* `kid` is accepted by `get_claims` and
  refused here. Refusing the algorithm outright also closes the classic confusion attack,
  where a forger re-signs with HS256 using the published public key as the shared secret.
- **`iss` and `aud` are checked.** `get_claims` checks neither, so a token minted by another
  Supabase project would turn on the signature check alone.
- **Verification stays local.** The HS256 fallback above is a network round trip per
  request, which is exactly what ADR-0005 chose JWKS to avoid.

`PyJWKClient` is synchronous, so its one fetch per cache lifetime runs in a worker thread
rather than on the event loop.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Final
from uuid import UUID

import jwt
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError

from sync_core import get_logger

logger = get_logger(__name__)

JWKS_PATH: Final = "/.well-known/jwks.json"

#: Signature algorithms a Sync access token may use. Symmetric ones are absent on purpose.
SUPPORTED_ALGORITHMS: Final = ("ES256", "RS256", "EdDSA")

#: Every Supabase access token is issued for this audience.
ACCESS_TOKEN_AUDIENCE: Final = "authenticated"

#: Claims without which a token is not one we can act on.
REQUIRED_CLAIMS: Final = ("exp", "sub", "aud", "iss")


class InvalidAccessTokenError(Exception):
    """The token is absent, malformed, expired, or not signed by GoTrue."""


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    """The parts of a verified token the API acts on."""

    #: `auth.users.id`, which the shared-PK identity makes `profiles.id` as well.
    subject: UUID
    email: str | None


class JwtVerifier:
    """Verifies access tokens against GoTrue's published signing keys."""

    def __init__(self, *, issuer: str, cache_seconds: float) -> None:
        self._issuer = issuer
        self._keys = PyJWKClient(
            f"{issuer}{JWKS_PATH}",
            cache_jwk_set=True,
            lifespan=cache_seconds,
            cache_keys=True,
        )

    async def verify(self, token: str) -> AccessTokenClaims:
        """Return the claims of a valid token, or raise `InvalidAccessTokenError`."""
        try:
            # Sync, and on a cache hit it does no IO at all — but the miss reads the network,
            # and one blocked event loop is not worth saving a thread hop every few minutes.
            key = await asyncio.to_thread(self._keys.get_signing_key_from_jwt, token)
        except PyJWKClientError as exc:
            logger.info("auth.signing_key_unavailable", error=type(exc).__name__)
            raise InvalidAccessTokenError("no published key signed this token") from exc
        except InvalidTokenError as exc:
            raise InvalidAccessTokenError("the token is not a readable JWT") from exc

        try:
            claims = jwt.decode(
                token,
                key=key,
                algorithms=list(SUPPORTED_ALGORITHMS),
                audience=ACCESS_TOKEN_AUDIENCE,
                issuer=self._issuer,
                options={"require": list(REQUIRED_CLAIMS)},
            )
        except InvalidTokenError as exc:
            raise InvalidAccessTokenError(f"the token did not verify: {exc}") from exc
        return _claims_from(claims)


def _claims_from(claims: dict[str, Any]) -> AccessTokenClaims:
    try:
        subject = UUID(str(claims["sub"]))
    except (KeyError, ValueError) as exc:
        raise InvalidAccessTokenError("the token's subject is not a profile id") from exc
    email = claims.get("email")
    return AccessTokenClaims(subject=subject, email=email if isinstance(email, str) else None)
