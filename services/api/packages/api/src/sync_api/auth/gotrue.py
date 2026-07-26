"""The API's side of the conversation with GoTrue, over `supabase-py`.

ADR-0005 makes this backend the only thing that ever talks to Supabase Auth, so the calls
below are the exact set that proxying costs us. ADR-0004 already names `supabase-py` as the
GoTrue client, and this is it — no hand-rolled HTTP, no hand-parsed error bodies.

What this module adds is the one thing the SDK cannot: statelessness. `AsyncGoTrueClient`
models a browser holding *one* session — signing in stores it on the client — so a single
long-lived instance shared by every request would end up holding the last person to sign
in, and any later call reading that stored session instead of an explicit argument would
act as them. A client is therefore built per call. It is a plain object over the process's
own `AsyncClient`, so this costs an allocation, not a connection.

Failures arrive as `AuthApiError.code` — GoTrue's own `error_code` string — and leave as
`GoTrueError` subclasses, so the flow layer above never pattern-matches on HTTP status.
"""

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
    """Which flow issued a one-time email token. GoTrue names them, and checks the name."""

    SIGNUP = "signup"
    RECOVERY = "recovery"
    INVITE = "invite"


#: Revoke every session the user has, not just the one presenting the token. A logout that
#: left the other devices signed in would not be the logout anyone means.
GLOBAL_SCOPE: Final = "global"


@dataclass(frozen=True, slots=True)
class GoTrueUser:
    """An identity in `auth.users`, as GoTrue reports it."""

    id: UUID
    email: str


@dataclass(frozen=True, slots=True)
class GoTrueSession:
    """A signed-in session: the pair of tokens the API turns into cookies."""

    access_token: str
    refresh_token: str
    #: Seconds until `access_token` expires — the access cookie's lifetime.
    expires_in: int
    user: GoTrueUser


class GoTrueError(Exception):
    """GoTrue refused, or could not be reached."""


class EmailAlreadyRegisteredError(GoTrueError):
    """The address already belongs to an identity."""


class InvalidCredentialsError(GoTrueError):
    """The email and password do not match an identity."""


class EmailNotConfirmedError(GoTrueError):
    """The identity exists but has not proven it owns the address."""


class InvalidEmailTokenError(GoTrueError):
    """A confirmation or recovery token is unknown, spent, or expired."""


class InvalidRefreshTokenError(GoTrueError):
    """The refresh token is unknown, spent, or was revoked by a logout."""


class WeakPasswordError(GoTrueError):
    """GoTrue's own password policy rejected the password."""


class PasswordUnchangedError(GoTrueError):
    """The new password is the one already on the account."""


class SessionAlreadyEndedError(GoTrueError):
    """The session behind the presented access token is already gone."""


class GoTrueUnavailableError(GoTrueError):
    """GoTrue could not be reached, or answered in a way we do not understand."""


#: A refusal GoTrue can answer a *particular* call with, and what it means for that call.
#: Deliberately per-call rather than one table: `validation_failed`, for one, means a spent
#: refresh token on `/token` and a malformed link on `/verify`. Anything unlisted is a bug
#: on our side or an outage on theirs, and becomes `GoTrueUnavailableError`.
Refusals = dict[str, type[GoTrueError]]


class GoTrue:
    """Every GoTrue call the auth flows make, and nothing else.

    The two Supabase keys are the caller identity: the service-role key for the admin
    endpoints, the anon key for the ones a browser would otherwise call itself.
    """

    def __init__(
        self, http: AsyncClient, *, url: str, service_role_key: str, anon_key: str
    ) -> None:
        self._http = http
        self._url = url
        self._service_role_key = service_role_key
        self._anon_key = anon_key

    async def create_user(self, *, email: str, password: str) -> GoTrueUser:
        """Provision an unconfirmed identity. Sends no email — `send_confirmation_email` does.

        Deliberately unconfirmed: ADR-0005 wants `auth.users` emails to be proven ones,
        because the communications sender resolves recipients from that table.
        """
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

    async def invite_user(self, *, email: str, redirect_to: str) -> GoTrueUser:
        """Provision an identity and send it the invite email, in one GoTrue call.

        Fails the same way `create_user` does when the address is already registered —
        `auth.users.email` is unique regardless of which flow created the row, which is what
        makes a Candidate address invited as a teammate (or vice versa) a clean refusal
        rather than something the API has to check for itself.
        """
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

    async def delete_user(self, user_id: UUID) -> None:
        """Erase an identity. `profiles` cascades from `auth.users`, so this undoes signup."""
        with refusals({}):
            await self._as_admin().admin.delete_user(str(user_id))

    async def send_confirmation_email(self, email: str) -> None:
        """Send the signup confirmation carrying the token `confirm_email` redeems."""
        with refusals({}):
            await self._as_caller().resend({"type": "signup", "email": email})

    async def send_password_reset_email(self, email: str) -> None:
        """Send the recovery email. Succeeds for unknown addresses too, by GoTrue's design."""
        with refusals({}):
            await self._as_caller().reset_password_for_email(email)

    async def sign_in_with_password(self, *, email: str, password: str) -> GoTrueSession:
        with refusals(
            {
                "invalid_credentials": InvalidCredentialsError,
                "email_not_confirmed": EmailNotConfirmedError,
            }
        ):
            answered = await self._as_caller().sign_in_with_password(
                {"email": email, "password": password}
            )
        return _session_from(answered.session)

    async def refresh_session(self, refresh_token: str) -> GoTrueSession:
        """Trade a refresh token for a new session. GoTrue rotates the refresh token itself."""
        with refusals(
            {
                "refresh_token_not_found": InvalidRefreshTokenError,
                "refresh_token_already_used": InvalidRefreshTokenError,
                "validation_failed": InvalidRefreshTokenError,
            }
        ):
            answered = await self._as_caller().refresh_session(refresh_token)
        return _session_from(answered.session)

    async def redeem_email_token(
        self, *, token_hash: str, token_type: EmailTokenType
    ) -> GoTrueSession:
        """Spend a one-time email token, which both confirms the address and signs the user in.

        The token is single-use: a second attempt raises `InvalidEmailTokenError`.
        """
        with refusals(
            {"otp_expired": InvalidEmailTokenError, "validation_failed": InvalidEmailTokenError}
        ):
            answered = await self._as_caller().verify_otp(
                {"token_hash": token_hash, "type": token_type.value}
            )
        return _session_from(answered.session)

    async def set_password(self, *, user_id: UUID, password: str) -> None:
        """Set the password of an identity the caller has already proven they control.

        Admin-side rather than through that identity's own session, because the only caller
        is the password reset, where the proof is the emailed token it has just redeemed.
        """
        with refusals(
            {"weak_password": WeakPasswordError, "same_password": PasswordUnchangedError}
        ):
            await self._as_admin().admin.update_user_by_id(str(user_id), {"password": password})

    async def revoke_sessions(self, access_token: str) -> None:
        """End every session of the user holding this access token."""
        with refusals(
            {"session_not_found": SessionAlreadyEndedError, "bad_jwt": SessionAlreadyEndedError}
        ):
            await self._as_admin().admin.sign_out(access_token, GLOBAL_SCOPE)

    def _as_caller(self) -> AsyncGoTrueClient:
        """A client speaking as an anonymous browser would."""
        return self._client(self._anon_key)

    def _as_admin(self) -> AsyncGoTrueClient:
        """A client speaking with the service role, for the `/admin` endpoints."""
        return self._client(self._service_role_key)

    def _client(self, key: str) -> AsyncGoTrueClient:
        return sdk_client(self._http, url=self._url, key=key)


def sdk_client(http: AsyncClient, *, url: str, key: str) -> AsyncGoTrueClient:
    """One SDK client, speaking as whoever holds `key`.

    Nothing about a call survives it: no stored session to leak into the next request, and
    no background timer refreshing a session nobody is holding.
    """
    return AsyncGoTrueClient(
        url=url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        http_client=http,
        auto_refresh_token=False,
        persist_session=False,
    )


class refusals:  # noqa: N801 — reads as a statement at the call site, not as a type
    """Translate whatever a block raises into the error that block means.

    A context manager rather than one table for the whole module, so each mapping sits at
    the call it describes and a reader can check it against the endpoint being called.

    `HTTPError` is caught alongside `AuthError` because the SDK only wraps the failures
    GoTrue *answered* with (`HTTPStatusError`); a connection it never made escapes raw, and
    a GoTrue that is down has to reach the flow layer as an outage rather than a 500.
    """

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

    # Unmapped: our bug or their outage, either way not something a caller can act on. The
    # detail goes to the logs rather than to the client.
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
