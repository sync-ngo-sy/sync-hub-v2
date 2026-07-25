"""The adapter over the SDK's verification, which is all that is ours to test.

Whether a signature holds is `get_claims()`'s question, and Supabase tests it. What is
tested here is what the API does with the answer: the claims it acts on, and the single
error every refusal has to become. How the verifier is *used* is covered through the API
in `test_auth_sessions.py`.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from httpx import ConnectError
from supabase_auth.errors import (
    AuthApiError,
    AuthInvalidJwtError,
    AuthRetryableError,
    AuthSessionMissingError,
)

from sync_api.auth.tokens import InvalidAccessTokenError, JwtVerifier


class _Sdk:
    """Stands in for the SDK client, answering with claims or raising the way it does."""

    def __init__(self, answer: dict[str, Any] | Exception | None) -> None:
        self._answer = answer

    async def get_claims(self, jwt: str | None = None) -> dict[str, Any] | None:
        if isinstance(self._answer, Exception):
            raise self._answer
        return self._answer


def verifier_answering(claims: dict[str, Any]) -> JwtVerifier:
    return JwtVerifier(_Sdk({"claims": claims, "headers": {}, "signature": b""}))


def verifier_raising(error: Exception) -> JwtVerifier:
    return JwtVerifier(_Sdk(error))


async def test_a_verified_token_becomes_claims() -> None:
    subject = uuid4()

    claims = await verifier_answering({"sub": str(subject), "email": "amina@example.com"}).verify(
        "a.token"
    )

    assert claims.subject == subject
    assert claims.email == "amina@example.com"


async def test_a_token_with_no_subject_is_refused() -> None:
    with pytest.raises(InvalidAccessTokenError):
        await verifier_answering({"email": "amina@example.com"}).verify("a.token")


@pytest.mark.parametrize("subject", [None, "", "not-a-uuid", 42])
async def test_a_subject_that_is_not_a_uuid_is_refused(subject: object) -> None:
    with pytest.raises(InvalidAccessTokenError):
        await verifier_answering({"sub": subject}).verify("a.token")


@pytest.mark.parametrize("email", [None, 42, {"address": "amina@example.com"}])
async def test_an_email_that_is_not_a_string_becomes_none(email: object) -> None:
    claims = await verifier_answering({"sub": str(uuid4()), "email": email}).verify("a.token")

    assert claims.email is None


async def test_a_missing_email_becomes_none() -> None:
    claims = await verifier_answering({"sub": str(uuid4())}).verify("a.token")

    assert claims.email is None


@pytest.mark.parametrize(
    "error",
    [
        AuthInvalidJwtError("Invalid JWT signature"),
        AuthApiError("invalid claim: missing sub claim", 403, "bad_jwt"),
        AuthSessionMissingError(),
        AuthRetryableError("GoTrue did not answer", 0),
        # A GoTrue that cannot be reached must refuse rather than admit.
        ConnectError("nothing is listening"),
        KeyError("exp"),
    ],
)
async def test_a_refusal_from_the_sdk_is_an_invalid_token(error: Exception) -> None:
    """Whatever the SDK raises, the route above answers 401 and says nothing more."""
    with pytest.raises(InvalidAccessTokenError):
        await verifier_raising(error).verify("a.token")


async def test_an_answer_without_claims_is_refused() -> None:
    with pytest.raises(InvalidAccessTokenError):
        await JwtVerifier(_Sdk(None)).verify("a.token")
