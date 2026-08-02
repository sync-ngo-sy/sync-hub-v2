from __future__ import annotations

import asyncio
import re
from typing import TYPE_CHECKING, Final

from httpx import AsyncClient, HTTPError

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

DELIVERY_TIMEOUT_SECONDS: Final = 10.0
POLL_INTERVAL_SECONDS: Final = 0.05

TOKEN_HASH_PATTERN: Final = re.compile(r"token_hash=([A-Za-z0-9_-]+)")


class MailboxError(AssertionError):
    pass


class Mailbox:
    def __init__(self, http: AsyncClient) -> None:
        self._http = http

    async def confirmation_token(self, email: str) -> str:
        body = await self._newest_body(email)
        found = TOKEN_HASH_PATTERN.search(body)
        if found is None:
            raise MailboxError(f"the message to {email} carries no token_hash:\n{body}")
        return found.group(1)

    async def count_for(self, email: str) -> int:
        return len(await self._messages_for(email))

    async def count_reaches(self, email: str, wanted: int) -> int:
        """Waits for delivery, so a test can tell a second message from the same one twice."""
        deadline = asyncio.get_running_loop().time() + DELIVERY_TIMEOUT_SECONDS
        while True:
            arrived = await self.count_for(email)
            if arrived >= wanted or asyncio.get_running_loop().time() >= deadline:
                return arrived
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def newest_body(self, email: str) -> str:
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
