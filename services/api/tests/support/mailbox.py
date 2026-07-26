"""Reading the mail the local stack catches.

`supabase start` runs Mailpit in place of an SMTP server, so every message GoTrue sends is
retrievable. Tests use it the way a person would: sign up, open the email, follow the link.
That is the only way to prove the whole chain — that the template is wired up, that it
carries a `token_hash`, and that the API can redeem it — rather than reaching into
`auth.users` for a token no user would ever have seen.
"""

from __future__ import annotations

import asyncio
import re
from typing import TYPE_CHECKING, Final

from httpx import AsyncClient, HTTPError

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

#: GoTrue answers the API before Mailpit has necessarily filed the message.
DELIVERY_TIMEOUT_SECONDS: Final = 10.0
POLL_INTERVAL_SECONDS: Final = 0.05

#: What the templates in `supabase/templates/` put in their links.
TOKEN_HASH_PATTERN: Final = re.compile(r"token_hash=([A-Za-z0-9_-]+)")


class MailboxError(AssertionError):
    """The expected email never arrived, or did not carry what it should."""


class Mailbox:
    """The stack's catch-all inbox, queried by recipient."""

    def __init__(self, http: AsyncClient) -> None:
        self._http = http

    async def confirmation_token(self, email: str) -> str:
        """The `token_hash` from the newest message sent to `email`.

        Both templates carry it under the same query parameter, so this reads a signup
        confirmation and a password reset alike; the caller knows which it asked for.
        """
        body = await self._newest_body(email)
        found = TOKEN_HASH_PATTERN.search(body)
        if found is None:
            raise MailboxError(f"the message to {email} carries no token_hash:\n{body}")
        return found.group(1)

    async def count_for(self, email: str) -> int:
        return len(await self._messages_for(email))

    async def newest_body(self, email: str) -> str:
        """The whole of the newest message to `email`.

        For the properties a `token_hash` cannot show: which page the link lands on, most of
        all. GoTrue substitutes `site_url` for any `redirect_to` it does not recognise, and
        the token in a misdirected email is every bit as valid — so the only way to catch
        that is to read the address out of the message a person would have clicked.
        """
        return await self._newest_body(email)

    async def _newest_body(self, email: str) -> str:
        deadline = asyncio.get_running_loop().time() + DELIVERY_TIMEOUT_SECONDS
        while True:
            messages = await self._messages_for(email)
            if messages:
                message = await self._http.get(f"/api/v1/message/{messages[0]['ID']}")
                message.raise_for_status()
                document = message.json()
                return str(document.get("HTML") or document.get("Text") or "")
            if asyncio.get_running_loop().time() >= deadline:
                raise MailboxError(f"no message reached {email} within {DELIVERY_TIMEOUT_SECONDS}s")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def _messages_for(self, email: str) -> list[dict[str, object]]:
        """Newest first. Searching by recipient is what keeps tests from reading each other's
        mail — nothing empties this inbox between them."""
        response = await self._http.get(
            "/api/v1/search", params={"query": f'to:"{email}"', "limit": 20}
        )
        response.raise_for_status()
        messages = response.json().get("messages", [])
        return list(messages)


async def mailbox_at(base_url: str) -> AsyncIterator[Mailbox]:
    async with AsyncClient(base_url=base_url, timeout=5.0) as http:
        try:
            (await http.get("/api/v1/info")).raise_for_status()
        except HTTPError as exc:  # pragma: no cover — a stack misconfiguration, not a failure
            raise MailboxError(
                f"Mailpit is not answering at {base_url}. It ships with `supabase start`; "
                "check it was not excluded with `-x mailpit`."
            ) from exc
        yield Mailbox(http)
