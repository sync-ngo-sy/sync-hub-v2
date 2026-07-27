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

# `nojoined`: three tables share a primary key with the table they reference and are queues
# or snapshots, not subclasses. `use_inflect`: singular class names. `nobidi`: no
# back_populates, which read-only relationships have nothing to keep in sync.
GENERATOR_OPTIONS = "nojoined,use_inflect,nobidi"

RELATIONSHIP_CALL = re.compile(r"= relationship\((.*)\)$", re.MULTILINE)

# sqlacodegen targets older Pythons than this project: bare `dict` for jsonb fails mypy
# --strict, and the pre-3.11 `str, Enum` idiom trips ruff UP042.
SOURCE_FIXUPS = {
    "Mapped[dict]": "Mapped[dict[str, Any]]",
    "Mapped[Optional[dict]]": "Mapped[Optional[dict[str, Any]]]",
    "(str, enum.Enum):": "(enum.StrEnum):",
}


def reflection_url(url: str) -> str:
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

    OUTFILE.write_text(source)

    subprocess.run(["ruff", "check", "--fix", str(OUTFILE)], check=True, cwd=SERVICE_ROOT)
    subprocess.run(["ruff", "format", str(OUTFILE)], check=True, cwd=SERVICE_ROOT)

    print(f"wrote {OUTFILE.relative_to(SERVICE_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
