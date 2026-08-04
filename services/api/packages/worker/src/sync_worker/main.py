from __future__ import annotations

import asyncio
import os
import sys
from typing import TYPE_CHECKING

import uvicorn

from sync_worker.worker import drain_once

if TYPE_CHECKING:
    from collections.abc import Sequence

#: Cloud Run names the port it expects the container to listen on. 8080 is its default, and
#: the local fallback.
DEFAULT_PORT = 8080

USAGE = """\
usage: sync-worker [drain]

  sync-worker          serve the drain endpoints (what the container runs)
  sync-worker drain    sweep and drain once, print what happened, exit
"""


def serve() -> None:
    uvicorn.run(
        "sync_worker.service:create_app",
        factory=True,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", DEFAULT_PORT)),
        access_log=False,
    )


def drain() -> None:
    """One pass, for a developer's machine or an operator clearing a backlog.

    Nothing calls the endpoints locally — no database webhook, no scheduler — so without this
    a queued CV would sit there however long the worker was left running.
    """
    report = asyncio.run(drain_once())
    for queue, count in sorted(report.processed.items()):
        swept = report.swept.get(queue, 0)
        bounded = " (stopped at the row limit; run again)" if queue in report.truncated else ""
        print(f"{queue}: processed {count}, swept {swept}{bounded}")
    print(f"total: processed {report.total_processed}, swept {report.total_swept}")


def main(argv: Sequence[str] | None = None) -> None:
    args = list(sys.argv[1:] if argv is None else argv)
    match args:
        case []:
            serve()
        case ["drain"]:
            drain()
        case _:
            print(USAGE, file=sys.stderr, end="")
            raise SystemExit(2)


if __name__ == "__main__":
    main()
