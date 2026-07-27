from __future__ import annotations

import asyncio
from contextlib import suppress

from sync_core import get_settings
from sync_worker.worker import run_worker


def main() -> None:
    with suppress(KeyboardInterrupt):
        asyncio.run(run_worker(get_settings()))


if __name__ == "__main__":
    main()
