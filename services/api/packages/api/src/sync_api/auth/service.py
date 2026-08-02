from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import UUID

from sqlalchemy import func, select

from sync_api.auth.gotrue import (
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
from sync_api.auth.registration import (
    create_identity,
    identity_undone_on_failure,
    weak_password,
)
from sync_api.auth.tokens import InvalidAccessTokenError
from sync_api.problems import (
    EMAIL_NOT_CONFIRMED_PROBLEM_TYPE,
    IDENTITY_UNAVAILABLE_PROBLEM_TYPE,
    INVALID_CREDENTIALS_PROBLEM_TYPE,
    INVALID_EMAIL_TOKEN_PROBLEM_TYPE,
    NOT_AUTHENTICATED_PROBLEM_TYPE,
    PASSWORD_UNCHANGED_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger
from sync_core.models import AccountType, Candidate, Profile, User

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue, GoTrueSession
    from sync_api.auth.tokens import JwtVerifier

logger = get_logger(__name__)

UNAUTHENTICATED_DETAIL: Final = "Sign in to continue."


@dataclass(frozen=True, slots=True)
class ActingProfile:
    id: UUID
    email: str
    full_name: str
    account_type: AccountType
    avatar_url: str | None
    phone: str | None


@dataclass(frozen=True, slots=True)
class SignedIn:
    profile: ActingProfile
    session: GoTrueSession


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        gotrue: GoTrue,
        verifier: JwtVerifier,
        *,
        recruiter_portal_url: str | None = None,
    ) -> None:
        self._db = session
        self._gotrue = gotrue
        self._verifier = verifier
        self._recruiter_portal_url = recruiter_portal_url

    async def register_candidate(
        self, *, email: str, password: str, full_name: str
    ) -> ActingProfile:
        user = await create_identity(self._gotrue, email=email, password=password)
        async with identity_undone_on_failure(self._gotrue, user.id):
            await self._provision_candidate(user, full_name=full_name)
            await self._gotrue.send_confirmation_email(email)

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
        session = await self._redeem(token_hash, EmailTokenType.SIGNUP)
        profile = await self._load_profile(session.user.id)
        logger.info("auth.email_confirmed", profile_id=str(profile.id))
        return SignedIn(profile=profile, session=session)

    async def accept_invite(self, *, token_hash: str, password: str) -> SignedIn:
        session = await self._redeem(token_hash, EmailTokenType.INVITE)
        try:
            await self._gotrue.set_password(user_id=session.user.id, password=password)
        except WeakPasswordError as exc:
            raise weak_password() from exc

        profile = await self._load_profile(session.user.id)
        logger.info("auth.invite_accepted", profile_id=str(profile.id))
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
        if refresh_token is None:
            raise _unauthenticated("no refresh token cookie")
        try:
            session = await self._gotrue.refresh_session(refresh_token)
        except InvalidRefreshTokenError as exc:
            raise _unauthenticated("the refresh token is spent or revoked") from exc

        profile = await self._load_profile(session.user.id)
        return SignedIn(profile=profile, session=session)

    async def log_out(self, access_token: str | None) -> None:
        if access_token is None:
            return
        try:
            await self._gotrue.revoke_sessions(access_token)
        except SessionAlreadyEndedError:
            return
        except GoTrueUnavailableError:
            logger.warning("auth.logout_not_revoked")

    async def request_password_reset(self, email: str) -> None:
        account_type = await self._db.scalar(
            select(Profile.account_type)
            .join(User, User.id == Profile.id)
            .where(func.lower(User.email) == email.lower())
        )
        # A Platform admin takes the default alongside a Candidate, deliberately: no portal
        # serves them yet, and the candidate portal's reset page redeems the token whoever it
        # belongs to, then shows them the wrong-portal notice. #148 builds them one and adds
        # the third branch — and has to put its address in `additional_redirect_urls` too, or
        # GoTrue quietly falls back to `site_url` and the link still arrives here.
        redirect_to = self._recruiter_portal_url if account_type == AccountType.RECRUITER else None
        await self._gotrue.send_password_reset_email(email, redirect_to=redirect_to)

    async def reset_password(self, *, token_hash: str, password: str) -> None:
        session = await self._redeem(token_hash, EmailTokenType.RECOVERY)
        try:
            await self._gotrue.set_password(user_id=session.user.id, password=password)
        except WeakPasswordError as exc:
            raise weak_password() from exc
        except PasswordUnchangedError as exc:
            raise Problem(
                status=400,
                type=PASSWORD_UNCHANGED_PROBLEM_TYPE,
                detail="Choose a password you have not used on this account before.",
            ) from exc
        await self.log_out(session.access_token)
        logger.info("auth.password_reset", profile_id=str(session.user.id))

    async def acting_profile(self, access_token: str | None) -> ActingProfile:
        if access_token is None:
            raise _unauthenticated("no access token cookie")
        try:
            claims = await self._verifier.verify(access_token)
        except InvalidAccessTokenError as exc:
            raise _unauthenticated(exc) from exc
        return await self._load_profile(claims.subject)

    async def _provision_candidate(self, user: GoTrueUser, *, full_name: str) -> None:
        async with self._db.begin():
            self._db.add(
                Profile(id=user.id, account_type=AccountType.CANDIDATE, full_name=full_name)
            )
            await self._db.flush()
            self._db.add(Candidate(id=user.id))

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


def identity_provider_problem(exc: Exception) -> Problem:
    logger.error("auth.identity_provider_failed", error=type(exc).__name__)
    return Problem(
        status=502,
        type=IDENTITY_UNAVAILABLE_PROBLEM_TYPE,
        detail="The identity provider is not answering. Try again shortly.",
    )
