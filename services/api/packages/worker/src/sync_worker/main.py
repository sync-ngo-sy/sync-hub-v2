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
    """Run until signalled to stop.

    `run_worker` installs handlers for `SIGINT` and `SIGTERM` and shuts down by cancelling
    itself. The suppression here only covers a Ctrl-C in the moment before those handlers
    are installed, which is still an ordinary exit rather than a traceback.
    """
    with suppress(KeyboardInterrupt):
        asyncio.run(run_worker(get_settings()))


if __name__ == "__main__":
    main()
