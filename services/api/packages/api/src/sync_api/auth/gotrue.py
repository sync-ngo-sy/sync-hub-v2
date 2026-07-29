from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Final, Literal
from uuid import UUID

from httpx import HTTPError
from supabase_auth._async.gotrue_client import AsyncGoTrueClient
from supabase_auth.errors import AuthError, AuthRetryableError

from sync_core import get_logger

if TYPE_CHECKING:
    from httpx import AsyncClient
    from supabase_auth.types import Session, User

logger = get_logger(__name__)


class EmailTokenType(StrEnum):
    SIGNUP = "signup"
    RECOVERY = "recovery"
    INVITE = "invite"


GLOBAL_SCOPE: Final = "global"

#: A century, which is GoTrue's way of saying "until somebody lifts it".
BAN_FOREVER: Final = "876000h"


@dataclass(frozen=True, slots=True)
class GoTrueUser:
    id: UUID
    email: str


@dataclass(frozen=True, slots=True)
class GoTrueSession:
    access_token: str
    refresh_token: str
    expires_in: int
    user: GoTrueUser


class GoTrueError(Exception):
    pass


class EmailAlreadyRegisteredError(GoTrueError):
    pass


class InvalidCredentialsError(GoTrueError):
    pass


class EmailNotConfirmedError(GoTrueError):
    pass


class InvalidEmailTokenError(GoTrueError):
    pass


class InvalidRefreshTokenError(GoTrueError):
    pass


class WeakPasswordError(GoTrueError):
    pass


class PasswordUnchangedError(GoTrueError):
    pass


class SessionAlreadyEndedError(GoTrueError):
    pass


class GoTrueUnavailableError(GoTrueError):
    pass


Refusals = dict[str, type[GoTrueError]]


class GoTrue:
    def __init__(
        self, http: AsyncClient, *, url: str, service_role_key: str, anon_key: str
    ) -> None:
        self._http = http
        self._url = url
        self._service_role_key = service_role_key
        self._anon_key = anon_key

    async def create_user(self, *, email: str, password: str) -> GoTrueUser:
        with refusals(
            {
                "email_exists": EmailAlreadyRegisteredError,
                "user_already_exists": EmailAlreadyRegisteredError,
                "weak_password": WeakPasswordError,
            }
        ):
            answered = await self._as_admin().admin.create_user(
                {"email": email, "password": password, "email_confirm": False}
            )
        return _user_from(answered.user)

    async def delete_user(self, user_id: UUID) -> None:
        with refusals({}):
            await self._as_admin().admin.delete_user(str(user_id))

    async def send_confirmation_email(self, email: str) -> None:
        with refusals({}):
            await self._as_caller().resend({"type": "signup", "email": email})

    async def invite_user(self, *, email: str, redirect_to: str) -> GoTrueUser:
        with refusals(
            {
                "email_exists": EmailAlreadyRegisteredError,
                "user_already_exists": EmailAlreadyRegisteredError,
            }
        ):
            answered = await self._as_admin().admin.invite_user_by_email(
                email, {"redirect_to": redirect_to}
            )
        return _user_from(answered.user)

    async def send_password_reset_email(self, email: str) -> None:
        with refusals({}):
            await self._as_caller().reset_password_for_email(email)

    async def sign_in_with_password(self, *, email: str, password: str) -> GoTrueSession:
        with refusals(
            {
                "invalid_credentials": InvalidCredentialsError,
                "email_not_confirmed": EmailNotConfirmedError,
                # A deleted account. Indistinguishable from a wrong password on purpose: which
                # addresses once had an account is not something a login form should answer.
                "user_banned": InvalidCredentialsError,
            }
        ):
            answered = await self._as_caller().sign_in_with_password(
                {"email": email, "password": password}
            )
        return _session_from(answered.session)

    async def refresh_session(self, refresh_token: str) -> GoTrueSession:
        with refusals(
            {
                "refresh_token_not_found": InvalidRefreshTokenError,
                "refresh_token_already_used": InvalidRefreshTokenError,
                "validation_failed": InvalidRefreshTokenError,
                "user_banned": InvalidRefreshTokenError,
            }
        ):
            answered = await self._as_caller().refresh_session(refresh_token)
        return _session_from(answered.session)

    async def redeem_email_token(
        self, *, token_hash: str, token_type: EmailTokenType
    ) -> GoTrueSession:
        with refusals(
            {"otp_expired": InvalidEmailTokenError, "validation_failed": InvalidEmailTokenError}
        ):
            answered = await self._as_caller().verify_otp(
                {"token_hash": token_hash, "type": token_type.value}
            )
        return _session_from(answered.session)

    async def set_password(self, *, user_id: UUID, password: str) -> None:
        with refusals(
            {"weak_password": WeakPasswordError, "same_password": PasswordUnchangedError}
        ):
            await self._as_admin().admin.update_user_by_id(str(user_id), {"password": password})

    async def ban_user(self, user_id: UUID) -> None:
        """Indefinitely, so the credential stops opening anything without the row going away:
        `auth.users` is what every Profile hangs off, and an Application still names one."""
        with refusals({}):
            await self._as_admin().admin.update_user_by_id(
                str(user_id), {"ban_duration": BAN_FOREVER}
            )

    async def verify_password(self, *, email: str, password: str) -> None:
        """Confirm the caller is who the session says, before something irreversible.

        GoTrue offers no way to check a password without signing in, so this mints a session that
        is never used. Harmless where it is called — the account is banned moments later — but not
        a general-purpose check.
        """
        await self.sign_in_with_password(email=email, password=password)

    async def revoke_sessions(self, access_token: str) -> None:
        with refusals(
            {"session_not_found": SessionAlreadyEndedError, "bad_jwt": SessionAlreadyEndedError}
        ):
            await self._as_admin().admin.sign_out(access_token, GLOBAL_SCOPE)

    def _as_caller(self) -> AsyncGoTrueClient:
        return self._client(self._anon_key)

    def _as_admin(self) -> AsyncGoTrueClient:
        return self._client(self._service_role_key)

    def _client(self, key: str) -> AsyncGoTrueClient:
        return sdk_client(self._http, url=self._url, key=key)


def sdk_client(http: AsyncClient, *, url: str, key: str) -> AsyncGoTrueClient:
    return AsyncGoTrueClient(
        url=url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        http_client=http,
        auto_refresh_token=False,
        persist_session=False,
    )


class refusals:  # noqa: N801 — reads as a statement at the call site, not as a type
    def __init__(self, known: Refusals) -> None:
        self._known = known

    def __enter__(self) -> None:
        return None

    def __exit__(
        self, kind: object, exc: BaseException | None, traceback: object
    ) -> Literal[False]:
        if isinstance(exc, HTTPError):
            logger.warning("gotrue.unreachable", error=type(exc).__name__)
            raise GoTrueUnavailableError("GoTrue did not answer") from exc
        if isinstance(exc, AuthError):
            raise _translate(exc, self._known) from exc
        return False


def _translate(exc: AuthError, known: Refusals) -> GoTrueError:
    code = getattr(exc, "code", None)
    mapped = known.get(code) if isinstance(code, str) else None
    if mapped is not None:
        return mapped(str(exc))

    logger.error(
        "gotrue.unexpected_refusal",
        error=type(exc).__name__,
        error_code=code,
        status=getattr(exc, "status", None),
        retryable=isinstance(exc, AuthRetryableError),
    )
    return GoTrueUnavailableError(f"GoTrue refused with {code or type(exc).__name__}")


def _user_from(user: User | None) -> GoTrueUser:
    if user is None or not user.email:
        raise GoTrueUnavailableError("GoTrue described a user we cannot read")
    return GoTrueUser(id=UUID(str(user.id)), email=user.email)


def _session_from(session: Session | None) -> GoTrueSession:
    if session is None:
        raise GoTrueUnavailableError("GoTrue described a session we cannot read")
    return GoTrueSession(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
        user=_user_from(session.user),
    )
