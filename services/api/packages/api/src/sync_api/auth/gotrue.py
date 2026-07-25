"""The API's side of the conversation with GoTrue.

ADR-0005 makes this backend the only thing that ever talks to Supabase Auth: the SPAs hold
a cookie, not a token, and never learn a Supabase URL. So this module is not a general
Supabase client — it is the exact set of calls that proxying costs us, each one stateless
and each one taking every token it needs as an argument.

That statelessness is why `supabase-py`'s auth client is not used here even though
ADR-0004 keeps it around for Storage: it is built for a browser holding *one* session, so
signing in caches that session in the client and arms a background refresh timer. A server
signing in on behalf of thousands of people needs the opposite — a function call that
returns tokens and remembers nothing. Its admin API has no such state, but splitting the
GoTrue surface across two clients costs more than this module does.

Failures arrive as GoTrue's own `error_code` strings and leave as `GoTrueError`
subclasses, so the flow layer above never pattern-matches on HTTP status codes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final
from uuid import UUID

from httpx import HTTPError, Response

from sync_core import get_logger

if TYPE_CHECKING:
    from httpx import AsyncClient

logger = get_logger(__name__)

#: GoTrue names the confirmation and recovery one-time tokens by the flow that issued them.
SIGNUP_TOKEN_TYPE: Final = "signup"
RECOVERY_TOKEN_TYPE: Final = "recovery"

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

    One `AsyncClient` for the process. The two Supabase keys are the caller identity:
    the service-role key for the admin endpoints, the anon key for the ones a browser
    would otherwise call itself.
    """

    def __init__(self, http: AsyncClient, *, service_role_key: str, anon_key: str) -> None:
        self._http = http
        self._service_role_key = service_role_key
        self._anon_key = anon_key

    async def create_user(self, *, email: str, password: str) -> GoTrueUser:
        """Provision an unconfirmed identity. Sends no email — `send_confirmation_email` does.

        Deliberately unconfirmed: ADR-0005 wants `auth.users` emails to be proven ones,
        because the communications sender resolves recipients from that table.
        """
        payload = await self._call(
            "POST",
            "/admin/users",
            json={"email": email, "password": password, "email_confirm": False},
            key=self._service_role_key,
            authorization=self._service_role_key,
            refusals={
                "email_exists": EmailAlreadyRegisteredError,
                "user_already_exists": EmailAlreadyRegisteredError,
                "weak_password": WeakPasswordError,
            },
        )
        return _user_from(payload)

    async def delete_user(self, user_id: UUID) -> None:
        """Erase an identity. `profiles` cascades from `auth.users`, so this undoes signup."""
        await self._call(
            "DELETE",
            f"/admin/users/{user_id}",
            key=self._service_role_key,
            authorization=self._service_role_key,
        )

    async def send_confirmation_email(self, email: str) -> None:
        """Send the signup confirmation carrying the token `confirm_email` redeems."""
        await self._call(
            "POST", "/resend", json={"type": SIGNUP_TOKEN_TYPE, "email": email}, key=self._anon_key
        )

    async def send_password_reset_email(self, email: str) -> None:
        """Send the recovery email. Succeeds for unknown addresses too, by GoTrue's design."""
        await self._call("POST", "/recover", json={"email": email}, key=self._anon_key)

    async def sign_in_with_password(self, *, email: str, password: str) -> GoTrueSession:
        payload = await self._call(
            "POST",
            "/token",
            params={"grant_type": "password"},
            json={"email": email, "password": password},
            key=self._anon_key,
            refusals={
                "invalid_credentials": InvalidCredentialsError,
                "email_not_confirmed": EmailNotConfirmedError,
            },
        )
        return _session_from(payload)

    async def refresh_session(self, refresh_token: str) -> GoTrueSession:
        """Trade a refresh token for a new session. GoTrue rotates the refresh token itself."""
        payload = await self._call(
            "POST",
            "/token",
            params={"grant_type": "refresh_token"},
            json={"refresh_token": refresh_token},
            key=self._anon_key,
            refusals={
                "refresh_token_not_found": InvalidRefreshTokenError,
                "refresh_token_already_used": InvalidRefreshTokenError,
                "validation_failed": InvalidRefreshTokenError,
            },
        )
        return _session_from(payload)

    async def redeem_email_token(self, *, token_hash: str, token_type: str) -> GoTrueSession:
        """Spend a one-time email token, which both confirms the address and signs the user in.

        The token is single-use: a second attempt raises `InvalidEmailTokenError`.
        """
        payload = await self._call(
            "POST",
            "/verify",
            json={"type": token_type, "token_hash": token_hash},
            key=self._anon_key,
            refusals={
                "otp_expired": InvalidEmailTokenError,
                "validation_failed": InvalidEmailTokenError,
            },
        )
        return _session_from(payload)

    async def set_password(self, *, access_token: str, password: str) -> None:
        await self._call(
            "PUT",
            "/user",
            json={"password": password},
            key=self._anon_key,
            authorization=access_token,
            refusals={"weak_password": WeakPasswordError, "same_password": PasswordUnchangedError},
        )

    async def revoke_sessions(self, access_token: str) -> None:
        """End every session of the user holding this access token."""
        await self._call(
            "POST",
            "/logout",
            params={"scope": GLOBAL_SCOPE},
            key=self._anon_key,
            authorization=access_token,
            refusals={
                "session_not_found": SessionAlreadyEndedError,
                "bad_jwt": SessionAlreadyEndedError,
            },
        )

    async def _call(
        self,
        method: str,
        path: str,
        *,
        key: str,
        authorization: str | None = None,
        json: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
        refusals: Refusals | None = None,
    ) -> dict[str, Any]:
        headers = {"apikey": key}
        if authorization is not None:
            headers["Authorization"] = f"Bearer {authorization}"
        try:
            response = await self._http.request(
                method, path, json=json, params=params, headers=headers
            )
        except HTTPError as exc:
            # Neither the URL nor the message is logged: one can carry a token in its path,
            # the other the host. The call itself is enough to find the code.
            logger.warning("gotrue.unreachable", method=method, path=path, error=type(exc).__name__)
            raise GoTrueUnavailableError(f"GoTrue did not answer {method} {path}") from exc

        if response.is_success:
            return _body_of(response)
        raise _refusal(response, method=method, path=path, refusals=refusals or {})


def _refusal(response: Response, *, method: str, path: str, refusals: Refusals) -> GoTrueError:
    body = _body_of(response)
    code = body.get("error_code") or body.get("code")
    known = refusals.get(code) if isinstance(code, str) else None
    if known is not None:
        return known(str(body.get("msg") or body.get("message") or code))

    # Unmapped: our bug or their outage, either way not something a caller can act on. The
    # detail goes to the logs rather than to the client.
    logger.error(
        "gotrue.unexpected_response",
        method=method,
        path=path,
        status_code=response.status_code,
        error_code=code,
    )
    return GoTrueUnavailableError(f"GoTrue answered {response.status_code} to {method} {path}")


def _body_of(response: Response) -> dict[str, Any]:
    """GoTrue answers some calls with an empty body and some with `{}`; both mean "nothing"."""
    if not response.content:
        return {}
    try:
        body = response.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _user_from(payload: dict[str, Any]) -> GoTrueUser:
    try:
        return GoTrueUser(id=UUID(str(payload["id"])), email=str(payload["email"]))
    except (KeyError, ValueError) as exc:
        raise GoTrueUnavailableError("GoTrue described a user we cannot read") from exc


def _session_from(payload: dict[str, Any]) -> GoTrueSession:
    try:
        return GoTrueSession(
            access_token=str(payload["access_token"]),
            refresh_token=str(payload["refresh_token"]),
            expires_in=int(payload["expires_in"]),
            user=_user_from(payload["user"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise GoTrueUnavailableError("GoTrue described a session we cannot read") from exc
