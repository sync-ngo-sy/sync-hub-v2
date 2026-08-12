"""Recognising Cloud Scheduler by the token it signs rather than by a secret it repeats.

The worker has two callers and they are not alike. A database webhook is Postgres calling out,
and Postgres cannot mint a Google identity token -- the shared secret exists for it. Cloud
Scheduler can, so it should not be holding a copy of the same secret: a token is scoped to one
audience, expires on its own, and cannot be read out of a job definition by anyone who can list
jobs.

The service stays publicly invocable, because the webhook still has to reach it, so the token is
verified here rather than by Cloud Run's IAM.
"""

from __future__ import annotations

from typing import Final

import jwt
from jwt import PyJWKClient

from sync_core import get_logger

logger = get_logger(__name__)

GOOGLE_JWKS_URL: Final = "https://www.googleapis.com/oauth2/v3/certs"

#: Google stamps both spellings depending on the surface that issued the token, and neither is
#: more correct than the other. Accepting one and not the other fails in a way that looks like a
#: signature problem.
GOOGLE_ISSUERS: Final = frozenset({"https://accounts.google.com", "accounts.google.com"})


class OidcRejectedError(Exception):
    """The token was not a live Google token issued to us for the caller we expect."""


class SchedulerTokens:
    """Verifies one thing: that Google signed this token, for us, for that service account."""

    def __init__(
        self,
        *,
        audience: str,
        service_account: str,
        jwks_url: str = GOOGLE_JWKS_URL,
        keys: PyJWKClient | None = None,
    ) -> None:
        self._audience = audience
        self._service_account = service_account
        # Cached and rotated by the client. Google rotates these keys, so pinning one is a
        # deployment that breaks on a schedule nobody controls.
        self._keys = keys or PyJWKClient(jwks_url, cache_keys=True)

    def verify(self, token: str) -> str:
        """Return the caller's address, or raise. Never returns for a token it cannot place."""
        try:
            key = self._keys.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key=key,
                algorithms=["RS256"],
                audience=self._audience,
                options={"require": ["exp", "iat", "aud", "iss"]},
            )
        except jwt.PyJWTError as error:
            # Includes expiry and audience: pyjwt checks both, and an audience mismatch is the
            # one that matters most -- a token minted for another service is a valid Google
            # token, and replaying it here is exactly what `aud` exists to stop.
            raise OidcRejectedError(f"the token did not verify: {type(error).__name__}") from error
        except Exception as error:
            # Fetching the signing key reaches the network. A failure there is not a bad token,
            # but it must still refuse rather than admit one.
            raise OidcRejectedError(
                f"the signing key could not be fetched: {type(error).__name__}"
            ) from error

        issuer = claims.get("iss")
        if issuer not in GOOGLE_ISSUERS:
            raise OidcRejectedError(f"issuer {issuer!r} is not Google")

        # `email_verified` is Google asserting the address belongs to the identity it signed for.
        # Without it, `email` is a claim anybody's token could carry.
        if claims.get("email_verified") is not True:
            raise OidcRejectedError("the token's address is not verified")

        email = claims.get("email")
        if email != self._service_account:
            raise OidcRejectedError(f"{email!r} is not the caller we expect")

        return str(email)
