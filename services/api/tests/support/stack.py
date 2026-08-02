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

#: Truncated without RESTART IDENTITY: these belong to GoTrue and Storage, whose sequences
#: the `postgres` role does not own. This clears Storage's rows, not the objects behind
#: them — `tests.support.cvs.empty_cv_bucket` deletes those through Storage's own API first.
EXTERNAL_TABLES_TO_TRUNCATE: Final = ("auth.users", "storage.objects")


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


def truncate_script(public_tables: list[str]) -> str:
    external = ", ".join(EXTERNAL_TABLES_TO_TRUNCATE)
    ours = ", ".join(f'public."{name}"' for name in public_tables)
    return f"truncate table {external} cascade;\ntruncate table {ours} restart identity cascade;"


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


def pooler_url_from_direct_url() -> str | None:
    """Last resort: the direct URL with Supavisor's port and tenant-qualified user."""
    port, project = _pooler_config()
    direct = stack_config().get("DB_URL")
    if not (port and project and direct):
        return None
    parsed = urlsplit(direct)
    user = (parsed.username or "postgres").split(".", 1)[0]
    password = parsed.password or "postgres"
    netloc = f"{user}.{project}:{password}@{parsed.hostname}:{port}"
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))
