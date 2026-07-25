"""The one deliberate low seam in the auth work.

`JwtVerifier` is what makes ADR-0005's per-request check free — it reads GoTrue's signing
keys once and verifies locally from then on. Neither half of that is visible from the HTTP
boundary: a cached key and a refetched one produce identical responses, and a token that
expires an hour from now cannot be waited out by a test suite.

So these tests own their own signing key and their own JWKS endpoint, and count the fetches.
Everything about how the verifier is *used* is still tested through the API in
`test_auth_sessions.py`.
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any, Final
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from httpx import AsyncClient, MockTransport, Request, Response
from jwt.algorithms import ECAlgorithm

from sync_api.auth.tokens import (
    ACCESS_TOKEN_AUDIENCE,
    JWKS_PATH,
    InvalidAccessTokenError,
    JwtVerifier,
)

ISSUER: Final = "https://project.supabase.co/auth/v1"


class SigningKey:
    """One EC key, published as a JWK the way GoTrue publishes its own."""

    def __init__(self, key_id: str) -> None:
        self.key_id = key_id
        self._private = ec.generate_private_key(ec.SECP256R1())

    def as_jwk(self) -> dict[str, Any]:
        public: dict[str, Any] = json.loads(ECAlgorithm.to_jwk(self._private.public_key()))
        return {**public, "kid": self.key_id, "use": "sig", "alg": "ES256"}

    def sign(self, **claim_overrides: Any) -> str:
        issued = dt.datetime.now(tz=dt.UTC)
        claims: dict[str, Any] = {
            "iss": ISSUER,
            "sub": str(uuid4()),
            "aud": ACCESS_TOKEN_AUDIENCE,
            "iat": issued,
            "exp": issued + dt.timedelta(hours=1),
            "email": "amina@example.com",
            **claim_overrides,
        }
        return jwt.encode(claims, self._private, algorithm="ES256", headers={"kid": self.key_id})


class PublishedKeys:
    """A stand-in for GoTrue's JWKS endpoint that remembers how often it was read."""

    def __init__(self, *keys: SigningKey) -> None:
        self.keys = list(keys)
        self.reads = 0

    def now_publishes(self, *keys: SigningKey) -> None:
        self.keys = list(keys)

    def transport(self) -> MockTransport:
        def respond(request: Request) -> Response:
            assert request.url.path.endswith(JWKS_PATH)
            self.reads += 1
            return Response(200, json={"keys": [key.as_jwk() for key in self.keys]})

        return MockTransport(respond)


def verifier_for(published: PublishedKeys, **overrides: Any) -> JwtVerifier:
    http = AsyncClient(transport=published.transport(), base_url=ISSUER)
    return JwtVerifier(http, issuer=ISSUER, cache_seconds=600, **overrides)


async def test_a_genuine_token_verifies() -> None:
    key = SigningKey("current")
    published = PublishedKeys(key)
    subject = uuid4()

    claims = await verifier_for(published).verify(key.sign(sub=str(subject)))

    assert claims.subject == subject
    assert claims.email == "amina@example.com"


async def test_the_keys_are_read_once_and_reused() -> None:
    """The point of local verification: the second request costs no network hop."""
    key = SigningKey("current")
    published = PublishedKeys(key)
    verifier = verifier_for(published)

    await verifier.verify(key.sign())
    await verifier.verify(key.sign())

    assert published.reads == 1


async def test_a_rotated_key_is_picked_up_without_a_restart() -> None:
    """An unknown `kid` is the signal that the cache is behind, and forces a re-read."""
    old, new = SigningKey("old"), SigningKey("new")
    published = PublishedKeys(old)
    verifier = verifier_for(published, unknown_key_refetch_seconds=0)
    await verifier.verify(old.sign())

    published.now_publishes(new)

    assert await verifier.verify(new.sign())
    assert published.reads == 2


async def test_an_unknown_key_does_not_reread_on_every_attempt() -> None:
    """Otherwise a made-up `kid` is a way to make the API hammer GoTrue."""
    key = SigningKey("current")
    published = PublishedKeys(key)
    verifier = verifier_for(published, unknown_key_refetch_seconds=60)
    stranger = SigningKey("stranger")

    for _ in range(5):
        with pytest.raises(InvalidAccessTokenError):
            await verifier.verify(stranger.sign())

    assert published.reads == 1


async def test_a_token_from_an_unpublished_key_is_refused() -> None:
    published = PublishedKeys(SigningKey("current"))
    forger = SigningKey("current")  # same id, different key: a plausible-looking forgery

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(published).verify(forger.sign())


async def test_an_expired_token_is_refused() -> None:
    key = SigningKey("current")
    expired = dt.datetime.now(tz=dt.UTC) - dt.timedelta(minutes=1)

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(PublishedKeys(key)).verify(key.sign(exp=expired))


async def test_a_token_from_another_issuer_is_refused() -> None:
    """A Supabase access token from a *different* project is a genuine token — for them."""
    key = SigningKey("current")

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(PublishedKeys(key)).verify(key.sign(iss="https://elsewhere/auth/v1"))


async def test_a_token_for_another_audience_is_refused() -> None:
    key = SigningKey("current")

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(PublishedKeys(key)).verify(key.sign(aud="anon"))


async def test_a_token_with_no_subject_is_refused() -> None:
    key = SigningKey("current")

    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(PublishedKeys(key)).verify(key.sign(sub=None))


async def test_a_token_that_is_not_a_token_is_refused() -> None:
    with pytest.raises(InvalidAccessTokenError):
        await verifier_for(PublishedKeys(SigningKey("current"))).verify("nonsense")


async def test_unreachable_keys_refuse_rather_than_admit() -> None:
    """A JWKS endpoint that is down must not become a way past the check."""
    verifier = JwtVerifier(
        AsyncClient(transport=MockTransport(lambda _: Response(503)), base_url=ISSUER),
        issuer=ISSUER,
        cache_seconds=600,
    )

    with pytest.raises(InvalidAccessTokenError):
        await verifier.verify(SigningKey("current").sign())
