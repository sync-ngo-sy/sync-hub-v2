#!/usr/bin/env python
"""Prove a deployed SYNC_DATABASE_URL is the right shape and actually connects.

    uv run --project services/api scripts/check-database-url.py sync-ngo-staging

Reads the secret's latest version, reports what it points at with the password redacted, and
then connects the way the application does -- same URL rewriting, same asyncpg arguments -- so
a string that parses but cannot serve traffic fails here rather than in a Cloud Run revision.

The value is never printed. It is read into this process and redacted before anything is shown.

Checks, in the order they tend to be got wrong:

  1. No stray whitespace. `echo` writes a trailing newline, and a password with one is a
     password that does not match.
  2. The scheme is postgresql+asyncpg. The dashboard hands out `postgresql://`, which the
     application's own settings type refuses -- better to learn that here.
  3. The host is the transaction pooler, not the direct connection. Both work from a laptop;
     only one survives many short-lived Cloud Run instances.
  4. It connects, and reports the server's port so the pooler claim is evidence rather than
     inference.
  5. A prepared statement can be issued twice on the same pooled connection, which is what
     the prepared-statement settings in sync_core.db exist to make safe.
"""

from __future__ import annotations

import asyncio
import subprocess
import sys
from urllib.parse import urlsplit

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from sync_core.db import POOLER_CONNECT_ARGS, pooler_safe_url
from sync_core.settings import AsyncPostgresDsn

SECRET = "SYNC_DATABASE_URL"


def read_secret(project: str) -> str:
    result = subprocess.run(
        [
            "gcloud",
            "secrets",
            "versions",
            "access",
            "latest",
            f"--secret={SECRET}",
            f"--project={project}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        sys.exit(f"could not read {SECRET} from {project}:\n{result.stderr.strip()}")
    return result.stdout


def redacted(url: str) -> str:
    parts = urlsplit(url)
    user = (parts.username or "?") if parts.username else "?"
    return f"{parts.scheme}://{user}:***@{parts.hostname}:{parts.port}{parts.path}"


async def connect(url: str) -> None:
    engine = create_async_engine(pooler_safe_url(url), connect_args=POOLER_CONNECT_ARGS)
    try:
        async with engine.connect() as connection:
            row = (
                await connection.execute(
                    text("select current_user, current_database(), inet_server_port()")
                )
            ).one()
            print(f"  connected     user={row[0]} database={row[1]} server_port={row[2]}")

            counting = text(
                "select count(*) from information_schema.tables where table_schema = 'public'"
            )
            tables = (await connection.execute(counting)).scalar_one()
            pending = "  (migrations have not run yet)" if not tables else ""
            print(f"  public tables {tables}{pending}")

            # Twice, deliberately: one statement reused across pooled connections is the failure
            # transaction-mode pooling produces, and it does not show up on a single query.
            for _ in range(2):
                await connection.execute(text("select 1 where :x = :x"), {"x": 1})
            print("  prepared statements reusable")
    finally:
        await engine.dispose()


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(f"usage: {sys.argv[0]} <gcp-project>")
    project = sys.argv[1]

    raw = read_secret(project)
    url = raw.strip()
    print(f"{SECRET} in {project}")

    if raw != url:
        print("  WHITESPACE    the stored value has leading or trailing whitespace — rewrite it")
    else:
        print("  no whitespace")

    try:
        TypeAdapter(AsyncPostgresDsn).validate_python(url)
        print("  scheme        postgresql+asyncpg")
    except ValidationError:
        scheme = urlsplit(url).scheme
        sys.exit(
            f"  SCHEME        {scheme!r} — the application refuses this. "
            "Change it to postgresql+asyncpg://"
        )

    parts = urlsplit(url)
    host = parts.hostname or ""
    if "pooler" in host:
        print(f"  pooler        {host}:{parts.port}")
    else:
        print(f"  points at     {redacted(url)}")
        sys.exit(
            "\n".join(
                [
                    f"  DIRECT        {host}:{parts.port} is direct, not the pooler.",
                    "                The pooler's user is postgres.<project-ref>, its host",
                    "                contains 'pooler', and its port is not 5432. Copy it from",
                    "                the dashboard's transaction-pooler entry.",
                    "                Why it matters: many short-lived Cloud Run instances against",
                    "                a direct connection exhaust the connection limit. ADR-0016.",
                ]
            )
        )

    print(f"  points at     {redacted(url)}")
    try:
        asyncio.run(connect(url))
    # Broad on purpose: every failure here is a report for a person, not a crash.
    except Exception as error:
        sys.exit(f"  CONNECT       failed: {type(error).__name__}: {error}")


if __name__ == "__main__":
    main()
