"""A JWKS endpoint the tests own, served over real HTTP.

`PyJWKClient` fetches with `urllib`, so there is no transport to stub — the verifier has to
be pointed at something that actually answers. `http.server` from the standard library is
that something. A pytest plugin would do it too, but none of them is established enough to
add for one test module (ADR-0007), and the whole thing is thirty lines.
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Iterator


class PublishedKeys:
    """What the endpoint currently serves, and how often it has been read."""

    def __init__(self) -> None:
        #: Filled in once the server is bound and its port is known.
        self.url = ""
        self.reads = 0
        self.status = 200
        self.document: dict[str, Any] = {"keys": []}

    def publish(self, *jwks: dict[str, Any]) -> None:
        """(Re)point the endpoint at these keys, replacing whatever it served before."""
        self.document = {"keys": list(jwks)}

    def fail_with(self, status: int) -> None:
        """Answer every later read with this status, as an endpoint having a bad day would."""
        self.status = status


class _JwksServer(ThreadingHTTPServer):
    """Carries the served keys, so the handler has somewhere to read them from."""

    def __init__(self, path: str, keys: PublishedKeys) -> None:
        super().__init__(("127.0.0.1", 0), _Handler)
        self.path = path
        self.keys = keys


class _Handler(BaseHTTPRequestHandler):
    server: _JwksServer

    def do_GET(self) -> None:
        keys = self.server.keys
        if self.path != self.server.path:
            self.send_error(404)
            return

        keys.reads += 1
        if keys.status != 200:
            self.send_error(keys.status)
            return

        body = json.dumps(keys.document).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 — the base's name
        """Silence the default stderr access log; the tests assert on `reads` instead."""


@contextmanager
def serving_jwks(path: str) -> Iterator[PublishedKeys]:
    """Run a JWKS endpoint on a free port for the life of the block."""
    keys = PublishedKeys()
    server = _JwksServer(path, keys)
    host, port = server.server_address[:2]
    keys.url = f"http://{host!s}:{port}"

    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield keys
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
