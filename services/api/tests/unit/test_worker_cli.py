"""The command line, which is how the worker is driven locally.

Nothing calls the drain endpoints on a developer's machine, so `sync-worker drain` is the
only way a queued CV gets parsed without standing up a server and a shared secret.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from sync_worker import main as cli
from sync_worker.runner import DrainReport
from sync_worker.worker import drain_once

if TYPE_CHECKING:
    from collections.abc import Sequence


class StubWorker:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.closed = False

    async def scheduled(self) -> DrainReport:
        self.calls.append("scheduled")
        return DrainReport(processed={"ingestion": 2}, swept={"ingestion": 1})

    async def aclose(self) -> None:
        self.closed = True


async def test_draining_once_runs_the_scheduled_pass() -> None:
    worker = StubWorker()

    report = await drain_once(worker=worker)  # pyright: ignore[reportArgumentType]

    assert worker.calls == ["scheduled"]
    assert report.total_processed == 2
    assert report.total_swept == 1


async def test_an_injected_worker_is_left_open_for_its_owner_to_close() -> None:
    worker = StubWorker()

    await drain_once(worker=worker)  # pyright: ignore[reportArgumentType]

    assert worker.closed is False


def test_no_arguments_serves(monkeypatch: pytest.MonkeyPatch) -> None:
    served: list[bool] = []
    monkeypatch.setattr(cli, "serve", lambda: served.append(True))

    cli.main([])

    assert served == [True]


def test_drain_reports_each_queue(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    async def one_pass() -> DrainReport:
        return DrainReport(
            processed={"ingestion": 3, "communications": 0},
            swept={"ingestion": 1},
            truncated=["ingestion"],
        )

    monkeypatch.setattr(cli, "drain_once", one_pass)

    cli.main(["drain"])

    printed = capsys.readouterr().out
    assert "ingestion: processed 3, swept 1" in printed
    assert "communications: processed 0" in printed
    # Being told to run again matters: a bounded drain that looked complete would strand rows.
    assert "row limit" in printed
    assert "total: processed 3, swept 1" in printed


@pytest.mark.parametrize(
    "argv",
    [
        pytest.param(["nonsense"], id="unknown command"),
        pytest.param(["drain", "extra"], id="too many arguments"),
    ],
)
def test_anything_else_is_a_usage_error(argv: Sequence[str]) -> None:
    with pytest.raises(SystemExit) as exited:
        cli.main(argv)

    assert exited.value.code == 2
