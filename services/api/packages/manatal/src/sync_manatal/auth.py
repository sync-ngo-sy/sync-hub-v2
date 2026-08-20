from __future__ import annotations

import secrets
from typing import Final
from uuid import UUID

from httpx import AsyncClient, HTTPError, Response

from sync_core.settings import Settings

TAKEN: Final = frozenset({"email_exists", "user_already_exists"})
UNUSABLE_PASSWORD_BYTES: Final = 32


class ManatalAuthError(Exception):
    pass


class AddressTakenError(ManatalAuthError):
    pass


class ManatalAuth:
    def __init__(self, http: AsyncClient, *, settings: Settings) -> None:
        self._http = http
        self._settings = settings

    @classmethod
    def build(cls, settings: Settings) -> ManatalAuth:
        return cls(
            AsyncClient(timeout=settings.manatal_timeout_seconds),
            settings=settings,
        )

    async def create_account(self, *, email: str) -> UUID:
        answered = await self._post(
            "/auth/v1/admin/users",
            json={
                "email": email,
                "password": secrets.token_urlsafe(UNUSABLE_PASSWORD_BYTES),
                "email_confirm": False,
            },
        )
        if answered.status_code in (400, 409, 422):
            body = _body(answered)
            if str(body.get("error_code") or body.get("code") or "") in TAKEN or "already" in str(
                body.get("msg") or body.get("message") or ""
            ):
                raise AddressTakenError(f"an account already exists for {email}")
        _checked(answered, "create an account")
        made = _body(answered)
        user = made.get("user")
        identifier = made.get("id") or (user.get("id") if isinstance(user, dict) else None)
        if not isinstance(identifier, str):
            raise ManatalAuthError("Supabase Auth described an account we cannot read")
        return UUID(identifier)

    async def delete_account(self, account_id: UUID) -> None:
        _checked(
            await self._request("DELETE", f"/auth/v1/admin/users/{account_id}"),
            "delete an account",
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _post(self, path: str, *, json: dict[str, object]) -> Response:
        return await self._request("POST", path, json=json)

    async def _request(self, method: str, path: str, **sent: object) -> Response:
        key = self._settings.supabase_service_role_key.get_secret_value()
        base = str(self._settings.supabase_url).rstrip("/")
        try:
            return await self._http.request(
                method,
                f"{base}{path}",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    **dict(sent.pop("headers", {}) or {}),  # type: ignore[arg-type]
                },
                **sent,  # type: ignore[arg-type]
            )
        except HTTPError as unreachable:
            raise ManatalAuthError(
                f"Supabase did not answer {method} {path}: {type(unreachable).__name__}"
            ) from unreachable


def _checked(answered: Response, what: str) -> Response:
    if answered.is_success:
        return answered
    raise ManatalAuthError(
        f"Supabase would not {what} ({answered.status_code}): {answered.text[:300]}"
    )


def _body(answered: Response) -> dict[str, object]:
    try:
        body = answered.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}
