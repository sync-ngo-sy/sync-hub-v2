from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final
from uuid import uuid4

if TYPE_CHECKING:
    from httpx import AsyncClient, Response

ASK: Final = "/v1/access-requests"
QUEUE: Final = "/v1/platform/access-requests"


@dataclass(frozen=True, slots=True)
class Ask:
    """What a visitor types on the marketing site: no password, and no account behind it."""

    company: str
    full_name: str
    email: str


def an_ask(label: str = "acme", *, email: str | None = None) -> Ask:
    unique = uuid4().hex
    return Ask(
        company="Acme Recruiting",
        full_name="Rana Khalil",
        email=email if email is not None else f"{label}-wants-sync-{unique}@example.com",
    )


def an_ask_body(ask: Ask) -> dict[str, str]:
    return {"company": ask.company, "full_name": ask.full_name, "email": ask.email}


async def ask_for_access(visitor: AsyncClient, ask: Ask) -> Response:
    return await visitor.post(ASK, json=an_ask_body(ask))


async def read_queue(browser: AsyncClient) -> Response:
    return await browser.get(QUEUE)


async def convert(browser: AsyncClient, request_id: str, *, slug: str) -> Response:
    return await browser.post(f"{QUEUE}/{request_id}/tenant", json={"slug": slug})


async def dismiss(browser: AsyncClient, request_id: str) -> Response:
    return await browser.post(f"{QUEUE}/{request_id}/dismissal")


def a_slug(label: str = "acme") -> str:
    return f"{label}-{uuid4().hex}"
