from __future__ import annotations

import json
import re
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Final
from urllib.parse import urlsplit, urlunsplit

REPO_ROOT: Final = Path(__file__).resolve().parents[4]
SUPABASE_DIR: Final = REPO_ROOT / "supabase"

REFERENCE_SEED_GLOB: Final = "*_seed_reference.sql"


class StackError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def stack_config() -> dict[str, str]:
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
    matches = sorted(SUPABASE_DIR.glob(f"migrations/{REFERENCE_SEED_GLOB}"))
    if not matches:
        raise StackError(
            f"no migration matching {REFERENCE_SEED_GLOB!r} in {SUPABASE_DIR / 'migrations'} — "
            "the reference-data seed moved and the test harness needs updating."
        )
    return matches[-1].read_text()


def reset_script(public_tables: list[str], public_sequences: list[str]) -> str:
    """Empty every table named, in one round trip.

    DELETE rather than TRUNCATE. TRUNCATE allocates a fresh relfilenode for every relation it
    touches — each table and every index on it — and unlinks the old files at commit, whether
    the table held a row or not. Paid once per test, that dominated the suite: #265 measured
    331ms a call against 2.1ms for the DELETEs below, and climbing as the catalogue bloated. Do
    not read `TRUNCATE is faster than DELETE` off a benchmark of one large table and put it back.
    """
    ours = "".join(f'delete from public."{name}";\n' for name in public_tables)
    sequences = "".join(f'alter sequence public."{name}" restart;\n' for name in public_sequences)
    return (
        # `replica` lifts foreign-key enforcement, so the order of the deletes does not matter,
        # and it lifts the triggers that would otherwise refuse a delete outright — the domain's
        # `forbid_rewriting_history` and `forbid_locked_job_criteria`, and Storage's own
        # `protect_objects_delete` — or enqueue work off the back of one
        # (`enqueue_candidate_reembed`). TRUNCATE fired none of them; DELETE fires all of them.
        # The objects behind Storage's rows are already gone by here:
        # `tests.support.cvs.empty_cv_bucket` and its siblings remove those through Storage's
        # own API, which is what `protect_objects_delete` exists to insist on.
        "set session_replication_role = replica;\n"
        f"{ours}"
        "delete from storage.objects;\n"
        # Back to `default` for GoTrue, which needs its triggers: TRUNCATE CASCADE cleared
        # everything referencing `auth.users` whatever its ON DELETE action said, but DELETE
        # follows only a declared ON DELETE CASCADE, and GoTrue's own cascade is what clears the
        # identities, sessions and refresh tokens behind each user. Its sequences are left alone
        # either way — the `postgres` role does not own them.
        "set session_replication_role = default;\n"
        "delete from auth.users;\n"
        # DELETE leaves a sequence where it stood, so the restart that RESTART IDENTITY used to
        # do is done here instead. `test_isolation.py` holds the suite to it.
        f"{sequences}"
    )


def _pooler_config() -> tuple[str, str]:
    """(port, project_id) from supabase/config.toml."""
    config = (SUPABASE_DIR / "config.toml").read_text()
    section = config.partition("[db.pooler]")[2].partition("\n[")[0]
    port = re.search(r"^\s*port\s*=\s*(\d+)", section, re.MULTILINE)
    project = re.search(r'^\s*project_id\s*=\s*"([^"]+)"', config, re.MULTILINE)
    return (port.group(1) if port else ""), (project.group(1) if project else "")


def pooler_enabled() -> bool:
    config = (SUPABASE_DIR / "config.toml").read_text()
    section = config.partition("[db.pooler]")[2].partition("\n[")[0]
    return bool(re.search(r"^\s*enabled\s*=\s*true", section, re.MULTILINE))


def pooler_url_from_status_json() -> str | None:
    for key, value in stack_config().items():
        if "POOLER" in key.upper() and value:
            return str(value)
    return None


def pooler_url_from_status_text() -> str | None:
    """`supabase status` prints a Pooler URL that the JSON output omits."""
    port, _ = _pooler_config()
    if not port:
        return None
    result = subprocess.run(
        ["supabase", "status"], cwd=REPO_ROOT, capture_output=True, text=True, check=False
    )
    match = re.search(rf"postgresql://\S+:{port}/\S+", result.stdout)
    return match.group(0) if match else None


def pooler_url_candidates() -> list[str]:
    """Supavisor usernames to try, best guess first.

    The CLI does not publish the local tenant name anywhere -- not in `supabase status`,
    not in the config reference -- so the tenant is found by connecting rather than by
    being told. Each candidate is a complete URL built from the direct one.
    """
    port, project = _pooler_config()
    direct = stack_config().get("DB_URL")
    if not (port and direct):
        return []

    parsed = urlsplit(direct)
    base_user = (parsed.username or "postgres").split(".", 1)[0]
    password = parsed.password or "postgres"

    users = [base_user, f"{base_user}.{project}" if project else "", f"{base_user}.pooler-dev"]
    return [
        urlunsplit(
            (
                parsed.scheme,
                f"{user}:{password}@{parsed.hostname}:{port}",
                parsed.path,
                parsed.query,
                parsed.fragment,
            )
        )
        for user in users
        if user
    ]
