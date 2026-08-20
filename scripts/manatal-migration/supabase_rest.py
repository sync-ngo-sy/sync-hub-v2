"""The two Supabase services this migration needs, over their own REST APIs.

Auth, to make the account an imported Candidate owns their CV through, and Storage, to put the
resume where the platform expects to find it. Both with the service-role key, which is why this
script only ever runs from somewhere that key belongs.
"""

from __future__ import annotations

import secrets
from typing import TYPE_CHECKING, Final
from uuid import UUID

from httpx import AsyncClient, HTTPError, Response

if TYPE_CHECKING:
    from collections.abc import Mapping

CV_BUCKET: Final = "cvs"

#: GoTrue will not make an account without a password, so this invents one nobody is told and
#: nobody keeps. The address is left unconfirmed too: an import must never become a way in.
UNUSABLE_PASSWORD_BYTES: Final = 32

TAKEN: Final = frozenset({"email_exists", "user_already_exists"})


class SupabaseError(Exception):
    pass


class AddressTakenError(SupabaseError):
    """That address already has an account, which this migration never touches."""


class Supabase:
    def __init__(self, http: AsyncClient, *, url: str, service_role_key: str) -> None:
        self._http = http
        self._url = url.rstrip("/")
        self._key = service_role_key

    @classmethod
    def build(cls, *, url: str, service_role_key: str, timeout_seconds: float) -> Supabase:
        return cls(
            AsyncClient(timeout=timeout_seconds),
            url=url,
            service_role_key=service_role_key,
        )

    async def create_account(self, *, email: str) -> UUID:
        """An account that cannot be signed into: no password anybody holds, no confirmed address.

        Whoever owns it claims it later through the ordinary auth flows, which is not this
        script's business.
        """
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
        identifier = made.get("id") or made.get("user", {}).get("id")
        if not isinstance(identifier, str):
            raise SupabaseError("Supabase Auth described an account we cannot read")
        return UUID(identifier)

    async def delete_account(self, account_id: UUID) -> None:
        """Undoing an account this run made. `profiles.id → auth.users` cascades, so this takes
        the Candidate row with it and leaves the address free again."""
        _checked(
            await self._request("DELETE", f"/auth/v1/admin/users/{account_id}"),
            "delete an account",
        )

    async def upload_cv(self, path: str, content: bytes, *, media_type: str) -> None:
        answered = await self._request(
            "POST",
            f"/storage/v1/object/{CV_BUCKET}/{path}",
            content=content,
            headers={"content-type": media_type, "x-upsert": "true"},
        )
        _checked(answered, f"store {path}")

    async def remove_cv(self, path: str) -> None:
        await self._request("DELETE", f"/storage/v1/object/{CV_BUCKET}/{path}")

    async def read_cv(self, path: str) -> bytes | None:
        """The stored bytes, or None where the bucket has nothing at that path. Used by the
        verification pass to checksum what actually landed rather than trust the row."""
        answered = await self._request("GET", f"/storage/v1/object/{CV_BUCKET}/{path}")
        if answered.status_code == 404:
            return None
        return _checked(answered, f"read {path}").content

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _post(self, path: str, *, json: Mapping[str, object]) -> Response:
        return await self._request("POST", path, json=json)

    async def _request(self, method: str, path: str, **sent: object) -> Response:
        try:
            return await self._http.request(
                method,
                f"{self._url}{path}",
                headers={
                    "apikey": self._key,
                    "Authorization": f"Bearer {self._key}",
                    **dict(sent.pop("headers", {}) or {}),  # type: ignore[arg-type]
                },
                **sent,  # type: ignore[arg-type]
            )
        except HTTPError as unreachable:
            raise SupabaseError(
                f"Supabase did not answer {method} {path}: {type(unreachable).__name__}"
            ) from unreachable


def _checked(answered: Response, what: str) -> Response:
    if answered.is_success:
        return answered
    raise SupabaseError(
        f"Supabase would not {what} ({answered.status_code}): {answered.text[:300]}"
    )


def _body(answered: Response) -> dict[str, object]:
    try:
        body = answered.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}
