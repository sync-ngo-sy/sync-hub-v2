from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from sync_core.settings import Settings


class DocumentationUrls(TypedDict):
    openapi_url: str | None
    docs_url: str | None
    redoc_url: str | None


def documentation_urls(settings: Settings) -> DocumentationUrls:
    """Serve the schema where it is read, and nowhere a stranger can reach it.

    A published schema is the attack surface drawn to scale — and the worker's names
    `X-Worker-Secret`, the header that gates a `/drain` which has to stay publicly invocable
    for the database webhook to reach it. Local and CI keep the three routes because that is
    where the API client is generated from.
    """
    if settings.environment.is_deployed:
        return {"openapi_url": None, "docs_url": None, "redoc_url": None}
    return {"openapi_url": "/openapi.json", "docs_url": "/docs", "redoc_url": "/redoc"}
