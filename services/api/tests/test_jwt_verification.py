"""The one deliberate low seam in the auth work.

`JwtVerifier` is what makes ADR-0005's per-request check free. `PyJWKClient` does the
fetching, caching and key rotation, so what is worth testing here is the policy wrapped
around it — which algorithms, which issuer, which audience — plus the two properties the
ticket names that no HTTP response can show: that the keys are cached, and that a rotated
key is picked up without a restart.

These tests own a signing key and serve their own JWKS from a real HTTP server, because
`PyJWKClient` fetches with `urllib` and there is nothing to stub. Everything about how the
verifier is *used* is tested through the API in `test_auth_sessions.py`.
"""

from __future__ import annotations

import datetime as dt
import json
from typing import TYPE_CHECKING, Any, Final
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from jwt.algorithms import ECAlgorithm

from sync_api.auth.tokens import (
    ACCESS_TOKEN_AUDIENCE,
    JWKS_PATH,
    InvalidAccessTokenError,
    JwtVerifier,
)
from tests.support.jwks_server import PublishedKeys, serving_jwks

if TYPE_CHECKING:
    from collections.abc import Iterator

#: Long enough that nothing in a test run reaches it, so a second fetch means a cache miss.
A_LONG_CACHE: Final = 600.0


class SigningKey:
    """One EC key, published as a JWK the way GoTrue publishes its own."""

    def __init__(self, key_id: str) -> None:
        self.key_id = key_id
        self._private = ec.generate_private_key(ec.SECP256R1())

    def as_jwk(self) -> dict[str, Any]:
        public: dict[str, Any] = json.loads(ECAlgorithm.to_jwk(self._private.public_key()))
        return {**public, "kid": self.key_id, "use": "sig", "alg": "ES256"}

    def sign(self, issuer: str, **claim_overrides: Any) -> str:
        issued = dt.datetime.now(tz=dt.UTC)
        claims: dict[str, Any] = {
            "iss": issuer,
            "sub": str(uuid4()),
            "aud": ACCESS_TOKEN_AUDIENCE,
            "iat": issued,
            "exp": issued + dt.timedelta(hours=1),
            "email": "amina@example.com",
            **claim_overrides,
        }
        return jwt.encode(claims, self._private, algorithm="ES256", headers={"kid": self.key_id})


@pytest.fixture
def gotrue() -> Iterator[PublishedKeys]:
    """A stand-in for GoTrue's JWKS endpoint, on its own port."""
    with serving_jwks(JWKS_PATH) as keys:
        yield keys


def publish(gotrue: PublishedKeys, *keys: SigningKey) -> None:
    gotrue.publish(*(key.as_jwk() for key in keys))


def verifier_for(gotrue: PublishedKeys, cache_seconds: float = A_LONG_CACHE) -> JwtVerifier:
    return JwtVerifier(issuer=gotrue.url, cache_seconds=cache_seconds)


async def test_a_genuine_token_verifies(gotrue: PublishedKeys) -> None:
    key = SigningKey("current")
    publish(gotrue, key)
    subject = uuid4()

    claims = await verifier_for(gotrue).verify(key.sign(gotrue.url, sub=str(subject)))

    assert claims.subject == subject
    assert claims.email == "amina@example.com"


async def test_the_keys_are_read_once_and_reused(gotrue: PublishedKeys) -> None:
    """The point of local verification: the second request costs no network hop."""
    key = SigningKey("current")
    publish(gotrue, key)
    verifier = verifier_for(gotrue)

    await verifier.verify(key.sign(gotrue.url))
    await verifier.verify(key.sign(gotrue.url))

    assert gotrue.reads == 1


async def test_a_rotated_key_is_picked_up_without_a_restart(gotrue: PublishedKeys) -> None:
    """An unknown `kid` is the signal that the cache is behind, and forces a re-read."""
    old, new = SigningKey("old"), SigningKey("new")
    publish(gotrue, old)
    verifier = verifier_for(gotrue)
    await verifier.verify(old.sign(gotrue.url))

    publish(gotrue, new)

    assert await verifier.verify(new.sign(gotrue.url))


async def test_a_token_from_an_unpublished_key_is_refused(gotrue: PublishedKeys) -> None:
    publish(gotrue, SigningKey("current"))
    forger = SigningKey("current")  # same id, different key: a plausible-looking forgery

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(gotrue).verify(forger.sign(gotrue.url))


async def test_an_expired_token_is_refused(gotrue: PublishedKeys) -> None:
    key = SigningKey("current")
    publish(gotrue, key)
    expired = dt.datetime.now(tz=dt.UTC) - dt.timedelta(minutes=1)

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(gotrue).verify(key.sign(gotrue.url, exp=expired))


async def test_a_token_from_another_issuer_is_refused(gotrue: PublishedKeys) -> None:
    """A Supabase access token from a *different* project is a genuine token — for them."""
    key = SigningKey("current")
    publish(gotrue, key)

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(gotrue).verify(key.sign("https://elsewhere/auth/v1"))


async def test_a_token_for_another_audience_is_refused(gotrue: PublishedKeys) -> None:
    key = SigningKey("current")
    publish(gotrue, key)

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(gotrue).verify(key.sign(gotrue.url, aud="anon"))


async def test_a_token_with_no_subject_is_refused(gotrue: PublishedKeys) -> None:
    key = SigningKey("current")
    publish(gotrue, key)

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(gotrue).verify(key.sign(gotrue.url, sub=None))


async def test_a_token_that_is_not_a_token_is_refused(gotrue: PublishedKeys) -> None:
    publish(gotrue, SigningKey("current"))

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(gotrue).verify("nonsense")


async def test_unreachable_keys_refuse_rather_than_admit(gotrue: PublishedKeys) -> None:
    """A JWKS endpoint that is down must not become a way past the check."""
    gotrue.fail_with(503)

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(gotrue).verify(SigningKey("current").sign(gotrue.url))
