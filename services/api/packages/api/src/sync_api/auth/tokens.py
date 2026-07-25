"""Verifying an access token without asking anyone.

ADR-0005 puts a JWT check on every request, so it cannot cost a network hop. GoTrue signs
with an asymmetric key and publishes the public half at `/.well-known/jwks.json`; this
module reads that document once, caches it, and verifies locally from then on.

Only asymmetric algorithms are accepted. That is the whole defence against the classic
confusion attack, where a forger re-signs a token with HS256 using the *public* key as the
shared secret: a verifier that would accept HS256 accepts the forgery, and one that only
ever accepts `SUPPORTED_ALGORITHMS` cannot.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from time import monotonic
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

import jwt
from httpx import HTTPError
from jwt import InvalidTokenError, PyJWK, PyJWKSet

from sync_core import get_logger

if TYPE_CHECKING:
    from httpx import AsyncClient

logger = get_logger(__name__)

JWKS_PATH: Final = "/.well-known/jwks.json"

#: Signature algorithms a Sync access token may use. Symmetric ones are absent on purpose.
SUPPORTED_ALGORITHMS: Final = ("ES256", "RS256", "EdDSA")

#: Every Supabase access token is issued for this audience.
ACCESS_TOKEN_AUDIENCE: Final = "authenticated"

#: A token naming a `kid` we have never seen means the keys rotated, so the cache is
#: refetched early — but no more often than this, or an invalid `kid` becomes a way to make
#: the API hammer GoTrue.
UNKNOWN_KEY_REFETCH_INTERVAL: Final = 10.0


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

    def __init__(
        self,
        http: AsyncClient,
        *,
        issuer: str,
        cache_seconds: float,
        unknown_key_refetch_seconds: float = UNKNOWN_KEY_REFETCH_INTERVAL,
    ) -> None:
        self._http = http
        self._issuer = issuer
        self._cache_seconds = cache_seconds
        self._unknown_key_refetch_seconds = unknown_key_refetch_seconds
        self._lock = asyncio.Lock()
        self._keys: PyJWKSet | None = None
        self._fetched_at: float | None = None

    async def verify(self, token: str) -> AccessTokenClaims:
        """Return the claims of a valid token, or raise `InvalidAccessTokenError`."""
        try:
            key_id = jwt.get_unverified_header(token).get("kid")
        except InvalidTokenError as exc:
            raise InvalidAccessTokenError("the token is not a readable JWT") from exc
        if not isinstance(key_id, str):
            raise InvalidAccessTokenError("the token names no signing key")

        key = await self._signing_key(key_id)
        try:
            claims = jwt.decode(
                token,
                key=key,
                algorithms=list(SUPPORTED_ALGORITHMS),
                audience=ACCESS_TOKEN_AUDIENCE,
                issuer=self._issuer,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        except InvalidTokenError as exc:
            raise InvalidAccessTokenError(f"the token did not verify: {exc}") from exc
        return _claims_from(claims)

    async def _signing_key(self, key_id: str) -> PyJWK:
        keys = await self._cached_keys()
        found = _key_in(keys, key_id)
        if found is not None:
            return found

        # Either the keys rotated since the last fetch, or the token is signed by nobody.
        keys = await self._cached_keys(force_older_than=self._unknown_key_refetch_seconds)
        found = _key_in(keys, key_id)
        if found is None:
            raise InvalidAccessTokenError("the token names a signing key GoTrue does not publish")
        return found

    async def _cached_keys(self, *, force_older_than: float | None = None) -> PyJWKSet:
        """The JWKS document, refetched when the cache is older than the given age.

        The lock makes a burst of requests arriving on a cold cache cost one fetch, not one
        each; whoever wins re-checks the age so the losers use its result.
        """
        max_age = self._cache_seconds if force_older_than is None else force_older_than
        fresh = self._fresh_keys(max_age)
        if fresh is not None:
            return fresh

        async with self._lock:
            fresh = self._fresh_keys(max_age)
            if fresh is not None:
                return fresh
            keys = await self._fetch_keys()
            self._keys = keys
            self._fetched_at = monotonic()
            return keys

    def _fresh_keys(self, max_age: float) -> PyJWKSet | None:
        if self._keys is None or self._fetched_at is None:
            return None
        return self._keys if monotonic() - self._fetched_at < max_age else None

    async def _fetch_keys(self) -> PyJWKSet:
        try:
            response = await self._http.get(JWKS_PATH)
            response.raise_for_status()
            document = response.json()
        except (HTTPError, ValueError) as exc:
            logger.error("auth.jwks_unreadable", error=type(exc).__name__)
            raise InvalidAccessTokenError("the signing keys could not be read") from exc

        try:
            keys = PyJWKSet.from_dict(document)
        except (InvalidTokenError, AttributeError, KeyError, TypeError) as exc:
            logger.error("auth.jwks_unusable", error=type(exc).__name__)
            raise InvalidAccessTokenError("the signing keys could not be read") from exc

        logger.info("auth.jwks_loaded", keys=len(keys.keys))
        return keys


def _key_in(keys: PyJWKSet, key_id: str) -> PyJWK | None:
    """The signing key with this id, if the set publishes a usable one.

    `PyJWKSet` skips keys it cannot parse, and Supabase publishes only signing keys, so an
    absent id means "not ours" rather than "unsupported".
    """
    for key in keys.keys:
        if key.key_id == key_id and key.public_key_use in ("sig", None):
            return key
    return None


def _claims_from(claims: dict[str, Any]) -> AccessTokenClaims:
    try:
        subject = UUID(str(claims["sub"]))
    except (KeyError, ValueError) as exc:
        raise InvalidAccessTokenError("the token's subject is not a profile id") from exc
    email = claims.get("email")
    return AccessTokenClaims(subject=subject, email=email if isinstance(email, str) else None)
