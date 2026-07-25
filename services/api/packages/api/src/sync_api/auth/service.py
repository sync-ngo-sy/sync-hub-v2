"""The candidate auth flows, from HTTP request to GoTrue and Postgres and back.

The one thing worth reading closely is `register_candidate`. Signup spans two authorities —
GoTrue owns the identity, Postgres owns the Profile and the Candidate — and no transaction
covers both. What makes it atomic anyway is that the identity is created *first* and is
deleted again if anything downstream fails: `profiles.id` references `auth.users(id)` with
`ON DELETE CASCADE`, so removing the identity removes everything the flow had written.
Failure therefore leaves no half-built account, only an address that is free to sign up
again — which is the guarantee the ticket asks for.

Everything a route can answer with is raised here as a `Problem`, so the routes stay a
description of the HTTP surface and nothing else.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import UUID

from sqlalchemy import select

from sync_api.auth.gotrue import (
    EmailAlreadyRegisteredError,
    EmailNotConfirmedError,
    EmailTokenType,
    GoTrueUnavailableError,
    GoTrueUser,
    InvalidCredentialsError,
    InvalidEmailTokenError,
    InvalidRefreshTokenError,
    PasswordUnchangedError,
    SessionAlreadyEndedError,
    WeakPasswordError,
)
from sync_api.auth.tokens import InvalidAccessTokenError
from sync_api.problems import (
    EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE,
    EMAIL_NOT_CONFIRMED_PROBLEM_TYPE,
    IDENTITY_UNAVAILABLE_PROBLEM_TYPE,
    INVALID_CREDENTIALS_PROBLEM_TYPE,
    INVALID_EMAIL_TOKEN_PROBLEM_TYPE,
    NOT_AUTHENTICATED_PROBLEM_TYPE,
    PASSWORD_UNCHANGED_PROBLEM_TYPE,
    WEAK_PASSWORD_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger
from sync_core.models import AccountType, Candidate, Profile, User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue, GoTrueSession
    from sync_api.auth.tokens import JwtVerifier

logger = get_logger(__name__)

#: What a caller is told when their credentials, their token, or their session is no good.
#: One sentence for all three: which of them failed is not the client's business.
UNAUTHENTICATED_DETAIL: Final = "Sign in to continue."


@dataclass(frozen=True, slots=True)
class ActingProfile:
    """Who the request is on behalf of — the verified identity plus its Profile.

    The authorization checks ADR-0002 moved out of the database and into the API all start
    from this object.
    """

    id: UUID
    email: str
    full_name: str
    account_type: AccountType
    avatar_url: str | None
    phone: str | None


@dataclass(frozen=True, slots=True)
class SignedIn:
    """A completed sign-in: who it is, and the tokens that become their cookies."""

    profile: ActingProfile
    session: GoTrueSession


class AuthService:
    """One request's worth of auth work."""

    def __init__(self, session: AsyncSession, gotrue: GoTrue, verifier: JwtVerifier) -> None:
        self._db = session
        self._gotrue = gotrue
        self._verifier = verifier

    async def register_candidate(
        self, *, email: str, password: str, full_name: str
    ) -> ActingProfile:
        """Create the identity, the Profile and the Candidate, then ask for confirmation.

        Returns before the address is confirmed — there is no session to hand back yet,
        because ADR-0005 refuses login until the candidate proves they own the address.
        """
        try:
            user = await self._gotrue.create_user(email=email, password=password)
        except EmailAlreadyRegisteredError as exc:
            raise Problem(
                status=409,
                type=EMAIL_ALREADY_REGISTERED_PROBLEM_TYPE,
                detail="An account already exists for this email address.",
            ) from exc
        except WeakPasswordError as exc:
            raise _weak_password() from exc

        try:
            await self._provision_candidate(user, full_name=full_name)
            await self._gotrue.send_confirmation_email(email)
        except BaseException:
            await self._undo_identity(user.id)
            raise

        logger.info("auth.candidate_registered", profile_id=str(user.id))
        return ActingProfile(
            id=user.id,
            email=user.email,
            full_name=full_name,
            account_type=AccountType.CANDIDATE,
            avatar_url=None,
            phone=None,
        )

    async def confirm_email(self, token_hash: str) -> SignedIn:
        """Redeem the token from the confirmation email, which also signs the candidate in."""
        session = await self._redeem(token_hash, EmailTokenType.SIGNUP)
        profile = await self._load_profile(session.user.id)
        logger.info("auth.email_confirmed", profile_id=str(profile.id))
        return SignedIn(profile=profile, session=session)

    async def log_in(self, *, email: str, password: str) -> SignedIn:
        try:
            session = await self._gotrue.sign_in_with_password(email=email, password=password)
        except InvalidCredentialsError as exc:
            raise Problem(
                status=401,
                type=INVALID_CREDENTIALS_PROBLEM_TYPE,
                detail="That email and password do not match an account.",
            ) from exc
        except EmailNotConfirmedError as exc:
            raise Problem(
                status=403,
                type=EMAIL_NOT_CONFIRMED_PROBLEM_TYPE,
                detail="Confirm your email address before signing in.",
            ) from exc

        profile = await self._load_profile(session.user.id)
        return SignedIn(profile=profile, session=session)

    async def refresh(self, refresh_token: str | None) -> SignedIn:
        """Rotate the session. The old refresh token stops working once GoTrue replaces it."""
        if refresh_token is None:
            raise _unauthenticated("no refresh token cookie")
        try:
            session = await self._gotrue.refresh_session(refresh_token)
        except InvalidRefreshTokenError as exc:
            raise _unauthenticated("the refresh token is spent or revoked") from exc

        profile = await self._load_profile(session.user.id)
        return SignedIn(profile=profile, session=session)

    async def log_out(self, access_token: str | None) -> None:
        """Revoke every session of the caller.

        Never raises: the caller's cookies are cleared either way, and a logout that failed
        because the session was already gone has got what it came for.
        """
        if access_token is None:
            return
        try:
            await self._gotrue.revoke_sessions(access_token)
        except SessionAlreadyEndedError:
            return
        except GoTrueUnavailableError:
            logger.warning("auth.logout_not_revoked")

    async def request_password_reset(self, email: str) -> None:
        """Send the recovery email, if that address has an account.

        Says nothing about whether it does — the route answers the same way regardless, so
        this endpoint cannot be used to test which addresses are registered.
        """
        await self._gotrue.send_password_reset_email(email)

    async def reset_password(self, *, token_hash: str, password: str) -> None:
        """Redeem the recovery token and set the new password.

        The session the token bought is revoked immediately afterwards, along with every
        other session the account had: whoever forced the reset — including an attacker
        already signed in somewhere — is signed out, and the new password is the only way
        back in.
        """
        session = await self._redeem(token_hash, EmailTokenType.RECOVERY)
        try:
            await self._gotrue.set_password(user_id=session.user.id, password=password)
        except WeakPasswordError as exc:
            raise _weak_password() from exc
        except PasswordUnchangedError as exc:
            raise Problem(
                status=400,
                type=PASSWORD_UNCHANGED_PROBLEM_TYPE,
                detail="Choose a password you have not used on this account before.",
            ) from exc
        await self.log_out(session.access_token)
        logger.info("auth.password_reset", profile_id=str(session.user.id))

    async def acting_profile(self, access_token: str | None) -> ActingProfile:
        """Verify the access token and load the Profile it names."""
        if access_token is None:
            raise _unauthenticated("no access token cookie")
        try:
            claims = await self._verifier.verify(access_token)
        except InvalidAccessTokenError as exc:
            raise _unauthenticated(exc) from exc
        return await self._load_profile(claims.subject)

    async def _provision_candidate(self, user: GoTrueUser, *, full_name: str) -> None:
        """Write the Profile and the Candidate in one transaction.

        Ordered, not merely batched: the composite `(id, account_type)` foreign key means
        the Candidate row is unreferenceable until its Profile exists, so the flush between
        them is what the schema requires rather than a convenience.
        """
        async with self._db.begin():
            self._db.add(
                Profile(id=user.id, account_type=AccountType.CANDIDATE, full_name=full_name)
            )
            await self._db.flush()
            self._db.add(Candidate(id=user.id))

    async def _undo_identity(self, user_id: UUID) -> None:
        """Delete the identity a failed signup created, cascading away anything it wrote."""
        try:
            await self._gotrue.delete_user(user_id)
        except Exception:
            # Reported, not raised: the caller is already failing for a better reason, and
            # this line is what tells an operator an identity was stranded after all.
            logger.exception("auth.signup_rollback_failed", profile_id=str(user_id))

    async def _redeem(self, token_hash: str, token_type: EmailTokenType) -> GoTrueSession:
        try:
            return await self._gotrue.redeem_email_token(
                token_hash=token_hash, token_type=token_type
            )
        except InvalidEmailTokenError as exc:
            raise Problem(
                status=400,
                type=INVALID_EMAIL_TOKEN_PROBLEM_TYPE,
                detail="That link is invalid or has expired. Ask for a new one.",
            ) from exc

    async def _load_profile(self, profile_id: UUID) -> ActingProfile:
        """The acting Profile, or a 401 — a live identity with no usable Profile is nobody.

        The email comes from `auth.users` rather than from the token, so a Profile always
        reports the address GoTrue would actually mail.
        """
        row = (
            await self._db.execute(
                select(Profile, User.email)
                .join(User, User.id == Profile.id)
                .where(Profile.id == profile_id, Profile.deleted_at.is_(None))
            )
        ).first()
        if row is None:
            logger.warning("auth.profile_missing", profile_id=str(profile_id))
            raise _unauthenticated("the token names no live profile")

        profile, email = row
        return ActingProfile(
            id=profile.id,
            email=email or "",
            full_name=profile.full_name,
            account_type=profile.account_type,
            avatar_url=profile.avatar_url,
            phone=profile.phone,
        )


def _unauthenticated(reason: object) -> Problem:
    logger.info("auth.rejected", reason=str(reason))
    return Problem(status=401, type=NOT_AUTHENTICATED_PROBLEM_TYPE, detail=UNAUTHENTICATED_DETAIL)


def _weak_password() -> Problem:
    return Problem(
        status=400,
        type=WEAK_PASSWORD_PROBLEM_TYPE,
        detail="That password does not meet the identity provider's requirements.",
    )


def identity_provider_problem(exc: Exception) -> Problem:
    """GoTrue failed in a way no client can fix. The cause is already in the logs.

    Registered once, on the application, rather than caught in each flow: the answer is the
    same wherever it happens, and a per-method `except` clause is a line every future flow
    has to remember. The flows still catch the *specific* refusals, which differ.
    """
    logger.error("auth.identity_provider_failed", error=type(exc).__name__)
    return Problem(
        status=502,
        type=IDENTITY_UNAVAILABLE_PROBLEM_TYPE,
        detail="The identity provider is not answering. Try again shortly.",
    )
