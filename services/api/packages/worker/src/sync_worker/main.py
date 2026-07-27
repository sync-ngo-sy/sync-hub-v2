"""The worker's entry point: `sync-worker`, or `python -m sync_worker.main`.

The second deployable unit of the backend, alongside the API. Kept to the shape of
`sync_api.main` — read the settings, hand them to the thing that does the work — so a
Dockerfile for either one is the same file with a different command.
"""

from __future__ import annotations

import asyncio
from contextlib import suppress

from sync_core import get_settings
from sync_worker.worker import run_worker


def main() -> None:
    """Run until interrupted.

    `KeyboardInterrupt` is what `asyncio.run` raises on SIGINT, and Docker's SIGTERM
    reaches Python the same way; both mean the same thing here, and both are an ordinary
    exit rather than a traceback.
    """
    with suppress(KeyboardInterrupt):
        asyncio.run(run_worker(get_settings()))


if __name__ == "__main__":
    main()
