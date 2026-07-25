"""Regenerate `sync_core.models` from the migrated database schema.

ADR-0004: the database is the source of truth and the SQLAlchemy models are
generated from it with sqlacodegen and checked in — the same pattern as
`packages/db-types`. There is no Alembic; `supabase/migrations/` owns the schema.

Usage (needs the local stack running and migrated):

    supabase start
    supabase db reset
    uv run python scripts/generate_models.py

Then review the diff and commit `packages/core/src/sync_core/models.py`.

Reads `SYNC_DATABASE_URL` if set, otherwise the default local Supabase connection.
Reflection is synchronous, so the async driver in `SYNC_DATABASE_URL` is swapped for
psycopg (a dev-only dependency) before connecting.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

import pgvector.sqlalchemy  # noqa: F401  (registers `vector` for reflection)
from sqlacodegen.cli import main as sqlacodegen_main
from sqlalchemy.engine import make_url

LOCAL_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:54322/postgres"

SERVICE_ROOT = Path(__file__).resolve().parents[1]
OUTFILE = SERVICE_ROOT / "packages" / "core" / "src" / "sync_core" / "models.py"

# `nojoined`: several tables share a primary key with the table they reference
# (candidate_embedding_jobs, application_profile_snapshots, profiles). They are queues and
# snapshots, not subclasses — sqlacodegen's joined-table-inheritance guess is wrong here.
# `use_inflect`: singular class names, so the models read as the domain glossary does
# (Candidate, Application, Job) rather than as table names.
# `nobidi`: no back_populates. See `viewonly` below — with read-only relationships there is
# nothing for a back-reference to keep in sync.
GENERATOR_OPTIONS = "nojoined,use_inflect,nobidi"

BANNER = '''"""SQLAlchemy models generated from the database schema — DO NOT EDIT BY HAND.

Regenerate with `uv run python scripts/generate_models.py` after every migration
(ADR-0004). The database, not this file, is the source of truth.

Every relationship is `viewonly` — navigate and eager-load through them, but write by
assigning foreign key columns. The schema isolates tenants with composite foreign keys, so
most tenant-scoped tables reach their tenant through two overlapping paths (directly, and
via the recruiter who owns the row); a writable relationship would leave SQLAlchemy
guessing which one owns `tenant_id`. Explicit column writes are what ADR-0001 asks for
anyway: the backend composes its own transactions.
"""

'''

#: Matches one generated `relationship(...)` call, which sqlacodegen emits on a single line.
RELATIONSHIP_CALL = re.compile(r"= relationship\((.*)\)$", re.MULTILINE)

# sqlacodegen targets older Pythons than this project does, so its output needs two
# mechanical touch-ups: bare `dict` for jsonb columns (which mypy --strict rejects under
# `disallow_any_generics`; every jsonb payload in this schema is an object), and the
# pre-3.11 `str, Enum` idiom for the native enums (ruff UP042 — 3.12 has `StrEnum`).
SOURCE_FIXUPS = {
    "Mapped[dict]": "Mapped[dict[str, Any]]",
    "Mapped[Optional[dict]]": "Mapped[Optional[dict[str, Any]]]",
    "(str, enum.Enum):": "(enum.StrEnum):",
}


def reflection_url(url: str) -> str:
    """Return `url` with its driver swapped for the sync driver sqlacodegen needs."""
    sync = make_url(url).set(drivername="postgresql+psycopg")
    return sync.render_as_string(hide_password=False)


def main() -> int:
    database_url = os.environ.get("SYNC_DATABASE_URL", LOCAL_DATABASE_URL)

    sys.argv = [
        "sqlacodegen",
        "--generator",
        "declarative",
        "--schemas",
        "public",
        "--options",
        GENERATOR_OPTIONS,
        "--outfile",
        str(OUTFILE),
        reflection_url(database_url),
    ]
    sqlacodegen_main()

    source = OUTFILE.read_text()
    for old, new in SOURCE_FIXUPS.items():
        source = source.replace(old, new)

    source, rewritten = RELATIONSHIP_CALL.subn(r"= relationship(\1, viewonly=True)", source)
    remaining = source.count("= relationship(") - rewritten
    if remaining:
        raise SystemExit(
            f"{remaining} relationship(s) were not made viewonly — sqlacodegen's output "
            "no longer puts each call on one line, so the rewrite needs revisiting."
        )

    OUTFILE.write_text(BANNER + source)

    subprocess.run(["ruff", "check", "--fix", str(OUTFILE)], check=True, cwd=SERVICE_ROOT)
    subprocess.run(["ruff", "format", str(OUTFILE)], check=True, cwd=SERVICE_ROOT)

    print(f"wrote {OUTFILE.relative_to(SERVICE_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
