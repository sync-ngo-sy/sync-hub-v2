"""Driving the real local Supabase stack from the test suite.

The suite runs against `supabase start` — the same Postgres, the same migrations and
triggers, the same GoTrue and Storage as a deployment. Nothing here mocks the database;
these helpers only start from a known state and hand back the stack's connection details.
"""

from __future__ import annotations

import json
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Final

REPO_ROOT: Final = Path(__file__).resolve().parents[4]
SUPABASE_DIR: Final = REPO_ROOT / "supabase"

# Reference data — languages, skill categories, the Canonical skill taxonomy — is part of
# the schema contract, so it ships as a migration rather than as local seed data. Tests
# truncate it along with everything else and replay this file, which keeps one source of
# truth and leaves no room for a test to poison the taxonomy for its neighbours.
REFERENCE_SEED_GLOB: Final = "*_seed_reference.sql"

# Truncating `auth.users` cascades through GoTrue's own tables (identities, sessions) and
# into `public.profiles`; `storage.objects` drops the rows describing uploaded files.
# These belong to GoTrue and Storage, whose sequences the `postgres` role does not own —
# hence no RESTART IDENTITY on them. Only our own tables need predictable generated ids.
#
# This clears Storage's *rows*, not the objects behind them. Nothing uploads yet; the CV
# pipeline ticket has to add file cleanup here, or its tests will meet orphaned objects.
EXTERNAL_TABLES_TO_TRUNCATE: Final = ("auth.users", "storage.objects")


class StackError(RuntimeError):
    """The local Supabase stack is not usable."""


@lru_cache(maxsize=1)
def stack_config() -> dict[str, str]:
    """Connection details of the running local stack, from `supabase status`."""
    result = subprocess.run(
        ["supabase", "status", "-o", "json"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise StackError(
            "the local Supabase stack is not running — start it with `supabase start`.\n"
            f"{result.stderr.strip()}"
        )
    config: dict[str, str] = json.loads(result.stdout)
    return config


def reset_database() -> None:
    """Re-run every migration and the local seed, discarding all data.

    Slow (tens of seconds), so it happens once per session. Set
    `SYNC_TEST_SKIP_DB_RESET=1` to reuse an already-migrated database while iterating
    locally; CI always resets.
    """
    result = subprocess.run(
        ["supabase", "db", "reset", "--local"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise StackError(f"`supabase db reset` failed:\n{result.stdout}\n{result.stderr}")


@lru_cache(maxsize=1)
def reference_seed_sql() -> str:
    """The reference-data seed migration, replayed after each truncation."""
    matches = sorted(SUPABASE_DIR.glob(f"migrations/{REFERENCE_SEED_GLOB}"))
    if not matches:
        raise StackError(
            f"no migration matching {REFERENCE_SEED_GLOB!r} in {SUPABASE_DIR / 'migrations'} — "
            "the reference-data seed moved and the test harness needs updating."
        )
    return matches[-1].read_text()


def truncate_script(public_tables: list[str]) -> str:
    """Empty every data table.

    Each TRUNCATE names all its tables at once, so foreign keys never dictate an order.
    """
    external = ", ".join(EXTERNAL_TABLES_TO_TRUNCATE)
    ours = ", ".join(f'public."{name}"' for name in public_tables)
    return f"truncate table {external} cascade;\ntruncate table {ours} restart identity cascade;"
