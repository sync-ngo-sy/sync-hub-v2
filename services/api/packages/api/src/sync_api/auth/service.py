from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from sqlalchemy import select

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
from sync_api.auth.identities import by_address
from sync_api.auth.password_policy import PasswordPolicyError, enforce_password_policy
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
    WEAK_PASSWORD_PROBLEM_TYPE,
    Problem,
)
from sync_core import get_logger
from sync_core.models import (
    AccountType,
    Candidate,
    PlatformAdmin,
    Profile,
    Recruiter,
    RecruiterRole,
    Tenant,
    User,
)

if TYPE_CHECKING:
    from sqlalchemy import Row
    from sqlalchemy.ext.asyncio import AsyncSession

    from sync_api.auth.gotrue import GoTrue, GoTrueSession
    from sync_api.auth.tokens import JwtVerifier

logger = get_logger(__name__)

UNAUTHENTICATED_DETAIL: Final = "Sign in to continue."

ACTING_PROFILE: Final = (
    select(
        Profile,
        User.email,
        Candidate.id.label("candidate_row"),
        Recruiter.id.label("recruiter_row"),
        Recruiter.role,
        Recruiter.is_active.label("recruiter_is_active"),
        PlatformAdmin.id.label("platform_admin_row"),
        Tenant,
    )
    .join(User, User.id == Profile.id)
    .outerjoin(Candidate, Candidate.id == Profile.id)
    .outerjoin(Recruiter, Recruiter.id == Profile.id)
    .outerjoin(PlatformAdmin, PlatformAdmin.id == Profile.id)
    .outerjoin(Tenant, Tenant.id == Recruiter.tenant_id)
)


@dataclass(frozen=True, slots=True)
class ActingTenant:
    id: UUID
    name: str
    slug: str
    is_active: bool


@dataclass(frozen=True, slots=True)
class ActingMembership:
    role: RecruiterRole
    is_active: bool
    tenant: ActingTenant


@dataclass(frozen=True, slots=True)
class ActingProfile:
    id: UUID
    email: str
    full_name: str
    account_type: AccountType
    avatar_url: str | None
    phone: str | None
    phone_country: str | None
    has_account_row: bool = False
    membership: ActingMembership | None = None


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
        admin_portal_url: str | None = None,
    ) -> None:
        self._db = session
        self._gotrue = gotrue
        self._verifier = verifier
        self._recruiter_portal_url = recruiter_portal_url
        self._admin_portal_url = admin_portal_url

    async def register_candidate(
        self, *, email: str, password: str, full_name: str
    ) -> ActingProfile:
        password = _vetted(password)
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
            phone_country=None,
            has_account_row=True,
        )

    async def confirm_email(self, token_hash: str) -> SignedIn:
        session = await self._redeem(token_hash, EmailTokenType.SIGNUP)
        profile = await self._load_profile(session.user.id)
        logger.info("auth.email_confirmed", profile_id=str(profile.id))
        return SignedIn(profile=profile, session=session)

    async def accept_invite(self, *, token_hash: str, password: str) -> SignedIn:
        password = _vetted(password)
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
            select(Profile.account_type).join(User, User.id == Profile.id).where(*by_address(email))
        )
        if account_type == AccountType.RECRUITER:
            redirect_to = self._recruiter_portal_url
        elif account_type == AccountType.PLATFORM_ADMIN:
            redirect_to = self._admin_portal_url
        else:
            redirect_to = None
        await self._gotrue.send_password_reset_email(email, redirect_to=redirect_to)

    async def reset_password(self, *, token_hash: str, password: str) -> None:
        password = _vetted(password)
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
                ACTING_PROFILE.where(Profile.id == profile_id, Profile.deleted_at.is_(None))
            )
        ).first()
        if row is None:
            logger.warning("auth.profile_missing", profile_id=str(profile_id))
            raise _unauthenticated("the token names no live profile")

        profile: Profile = row.Profile
        return ActingProfile(
            id=profile.id,
            email=row.email or "",
            full_name=profile.full_name,
            account_type=profile.account_type,
            avatar_url=profile.avatar_url,
            phone=profile.phone,
            phone_country=profile.phone_country,
            has_account_row=_has_account_row(profile.account_type, row),
            membership=_membership_of(row),
        )


def _has_account_row(account_type: AccountType, row: Row[Any]) -> bool:
    if account_type is AccountType.CANDIDATE:
        return row.candidate_row is not None
    if account_type is AccountType.RECRUITER:
        return row.recruiter_row is not None
    return row.platform_admin_row is not None


def _membership_of(row: Row[Any]) -> ActingMembership | None:
    if row.recruiter_row is None:
        return None
    tenant: Tenant = row.Tenant
    return ActingMembership(
        role=row.role,
        is_active=row.recruiter_is_active,
        tenant=ActingTenant(
            id=tenant.id, name=tenant.name, slug=tenant.slug, is_active=tenant.is_active
        ),
    )


def _vetted(password: str) -> str:
    try:
        enforce_password_policy(password)
    except PasswordPolicyError as refusal:
        raise Problem(status=400, type=WEAK_PASSWORD_PROBLEM_TYPE, detail=str(refusal)) from refusal
    return password


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
