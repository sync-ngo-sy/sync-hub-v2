"""The seed's password must not be a constant, because the repository is public.

This was a real exposure rather than a hypothetical one. `Sync-Demo-2026` was committed here while
the seed refused to run anywhere but a laptop, which was fine. When the seed learned to fill
staging, that constant became a working credential on an internet-facing environment, published to
anyone who could read the repository -- and it signed in as a tenant admin.

The guard is cheap and the failure was not, so it is a test.
"""

from __future__ import annotations

import importlib
import re
from pathlib import Path

from seed import cast

CAST_SOURCE = Path(cast.__file__)


def test_the_password_is_not_a_literal_in_the_source() -> None:
    """A committed password outlives the environment it was meant for. A generated one cannot."""
    assignment = next(
        line for line in CAST_SOURCE.read_text().splitlines() if line.startswith("PASSWORD")
    )
    assert "secrets." in assignment, (
        f"PASSWORD must be generated, not written down. Found: {assignment}"
    )


def test_two_runs_do_not_share_a_password() -> None:
    """Reloading the module is what a second `seed_demo.py` invocation does, in one process."""
    first = cast.PASSWORD
    try:
        second = importlib.reload(cast).PASSWORD
        assert first != second
    finally:
        # Every other test in this session reads `cast.PASSWORD`; leaving a reloaded module
        # behind would hand them a different object than the one the fixtures were built from.
        importlib.reload(cast)


def test_the_password_is_long_enough_to_be_worth_generating() -> None:
    assert len(cast.PASSWORD) >= 20


def test_no_document_publishes_a_seed_password() -> None:
    """The docs described the password. Anything that looks like one is a regression."""
    docs = Path(__file__).resolve().parents[3] / "docs"
    offenders = [
        f"{path.name}:{n}"
        for path in docs.rglob("*.md")
        for n, line in enumerate(path.read_text().splitlines(), 1)
        if re.search(r"Sync-Demo-[A-Za-z0-9_-]{4,}", line)
    ]
    assert not offenders, f"a seed password is written down in: {offenders}"
