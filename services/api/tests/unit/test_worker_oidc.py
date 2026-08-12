"""Every way a token can be wrong, because the endpoint it guards spends money.

The tokens here are really signed and really verified — only the key lookup is stubbed, so the
signature check, the audience check and the expiry are the library's own, not a fake's.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from sync_worker.oidc import OidcRejectedError, SchedulerTokens

AUDIENCE = "https://worker-abc-ey.a.run.app"
CALLER = "scheduler@sync-ngo-staging.iam.gserviceaccount.com"

_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class StubKeys:
    """Stands in for the JWKS fetch. The verification itself stays real."""

    def __init__(self, public_key: Any = None, raises: Exception | None = None) -> None:
        self._public_key = public_key if public_key is not None else _KEY.public_key()
        self._raises = raises

    def get_signing_key_from_jwt(self, token: str) -> Any:
        if self._raises is not None:
            raise self._raises
        return type("Key", (), {"key": self._public_key})()


def a_token(*, key: Any = _KEY, **overrides: Any) -> str:
    now = dt.datetime.now(tz=dt.UTC)
    claims: dict[str, Any] = {
        "iss": "https://accounts.google.com",
        "aud": AUDIENCE,
        "email": CALLER,
        "email_verified": True,
        "sub": "1234567890",
        "iat": now,
        "exp": now + dt.timedelta(minutes=10),
    }
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm="RS256")


def verifier(keys: StubKeys | None = None) -> SchedulerTokens:
    return SchedulerTokens(
        audience=AUDIENCE,
        service_account=CALLER,
        keys=keys or StubKeys(),  # pyright: ignore[reportArgumentType]
    )


def test_a_token_from_the_scheduler_is_accepted() -> None:
    assert verifier().verify(a_token()) == CALLER


def test_both_spellings_of_the_google_issuer_are_accepted() -> None:
    """Google stamps either, and refusing one looks like a signature failure."""
    assert verifier().verify(a_token(iss="accounts.google.com")) == CALLER


def test_a_token_for_another_service_is_refused() -> None:
    """The replay that matters: a real Google token, minted for somebody else's audience."""
    with pytest.raises(OidcRejectedError, match="did not verify"):
        verifier().verify(a_token(aud="https://someone-elses-service.a.run.app"))


def test_a_token_from_another_service_account_is_refused() -> None:
    with pytest.raises(OidcRejectedError, match="is not the caller we expect"):
        verifier().verify(a_token(email="someone-else@evil.iam.gserviceaccount.com"))


def test_a_token_from_another_issuer_is_refused() -> None:
    with pytest.raises(OidcRejectedError, match="is not Google"):
        verifier().verify(a_token(iss="https://accounts.evil.example"))


def test_an_expired_token_is_refused() -> None:
    stale = dt.datetime.now(tz=dt.UTC) - dt.timedelta(hours=1)
    with pytest.raises(OidcRejectedError, match="did not verify"):
        verifier().verify(a_token(iat=stale, exp=stale + dt.timedelta(minutes=10)))


def test_an_unverified_address_is_refused() -> None:
    """Without this claim, `email` is something any token could assert."""
    with pytest.raises(OidcRejectedError, match="address is not verified"):
        verifier().verify(a_token(email_verified=False))


def test_a_token_signed_by_the_wrong_key_is_refused() -> None:
    with pytest.raises(OidcRejectedError, match="did not verify"):
        verifier().verify(a_token(key=_OTHER_KEY))


def test_a_token_missing_its_expiry_is_refused() -> None:
    """A token that never expires is a shared secret with extra steps."""
    token = jwt.encode(
        {
            "iss": "https://accounts.google.com",
            "aud": AUDIENCE,
            "email": CALLER,
            "email_verified": True,
            "iat": dt.datetime.now(tz=dt.UTC),
        },
        _KEY,
        algorithm="RS256",
    )
    with pytest.raises(OidcRejectedError, match="did not verify"):
        verifier().verify(token)


def test_a_key_that_cannot_be_fetched_refuses_rather_than_admits() -> None:
    """The network failing is not a reason to let a caller through."""
    broken = StubKeys(raises=ConnectionError("jwks unreachable"))
    with pytest.raises(OidcRejectedError, match="signing key could not be fetched"):
        verifier(broken).verify(a_token())


def test_nonsense_is_refused_without_raising_anything_else() -> None:
    with pytest.raises(OidcRejectedError):
        verifier().verify("not-a-jwt")
