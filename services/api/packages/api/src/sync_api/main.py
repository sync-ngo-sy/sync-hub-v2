from __future__ import annotations

import os

import uvicorn

from sync_api.app import create_app
from sync_core import get_settings

app = create_app()

#: Cloud Run names the port on `PORT`; 8000 is the image's own default and the local fallback.
DEFAULT_PORT = 8000


def serve() -> None:
    """Run the API under uvicorn with the trusted-proxy boundary taken from settings.

    `proxy_headers` on its own is not enough: uvicorn believes `X-Forwarded-For` only from the
    peers in `forwarded_allow_ips`, so the boundary has to be widened to the deployment's load
    balancer or every caller's rate-limit identity collapses onto the balancer's address.
    """
    settings = get_settings()
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", DEFAULT_PORT)),
        proxy_headers=True,
        forwarded_allow_ips=settings.forwarded_allow_ips,
    )
