from __future__ import annotations

import os

import uvicorn

#: Cloud Run names the port it expects the container to listen on. 8080 is its default, and
#: the local fallback.
DEFAULT_PORT = 8080


def main() -> None:
    uvicorn.run(
        "sync_worker.service:create_app",
        factory=True,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", DEFAULT_PORT)),
        access_log=False,
    )


if __name__ == "__main__":
    main()
