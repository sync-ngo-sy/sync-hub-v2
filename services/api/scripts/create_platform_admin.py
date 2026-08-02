"""Create a Platform admin against the environment this process is configured for.

A migration cannot do this: the auth user and its password belong to the identity provider,
not to the schema. Nor can an endpoint — the first Platform admin has nobody to authorise
them. So it is a script, run deliberately against a target, with the same `SYNC_*` settings
the API reads (`SYNC_DATABASE_URL`, `SYNC_SUPABASE_URL`, `SYNC_SUPABASE_SERVICE_ROLE_KEY`).

    uv run python scripts/create_platform_admin.py --email ops@sync.example --full-name "Nour"

The password is read from the terminal, or from SYNC_PLATFORM_ADMIN_PASSWORD where there is
no terminal to read it from. It is never a command-line argument: those are in the history
of every shell that ran them.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from getpass import getpass
from typing import TYPE_CHECKING

from dotenv import load_dotenv
from httpx import AsyncClient

from sync_api.auth import GoTrue
from sync_api.auth.gotrue import EmailAlreadyRegisteredError, GoTrueError, WeakPasswordError
from sync_api.platform import create_platform_admin
from sync_core import Database, get_settings

load_dotenv("./../.env")

if TYPE_CHECKING:
    from collections.abc import Sequence

PASSWORD_ENV_VAR = "SYNC_PLATFORM_ADMIN_PASSWORD"

GOTRUE_TIMEOUT_SECONDS = 10.0


def parse_arguments(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a Platform admin.")
    parser.add_argument("--email", required=True, help="The address the operator signs in with.")
    parser.add_argument("--full-name", required=True, help="How the product addresses them.")
    parser.add_argument(
        "--yes", action="store_true", help="Skip the confirmation of which environment this is."
    )
    return parser.parse_args(argv)


def read_password() -> str:
    from_environment = os.environ.get(PASSWORD_ENV_VAR)
    if from_environment:
        return from_environment

    password = getpass("Password: ")
    if password != getpass("Repeat it: "):
        raise SystemExit("The two passwords differ. Nothing was created.")
    if not password:
        raise SystemExit("An empty password. Nothing was created.")
    return password


def target_agreed(target: str) -> bool:
    return input(f"Create a Platform admin on {target}? [y/N] ").strip().lower() == "y"


async def run(*, email: str, full_name: str, password: str, skip_confirmation: bool) -> int:
    settings = get_settings()
    if not skip_confirmation and not target_agreed(str(settings.supabase_url)):
        print("Nothing was created.")
        return 1

    database = Database(settings)
    try:
        async with AsyncClient(timeout=GOTRUE_TIMEOUT_SECONDS) as http:
            gotrue = GoTrue(
                http,
                url=settings.gotrue_url,
                service_role_key=settings.supabase_service_role_key.get_secret_value(),
                anon_key=settings.supabase_anon_key.get_secret_value(),
            )
            async with database.session() as session:
                admin = await create_platform_admin(
                    session, gotrue, email=email, password=password, full_name=full_name
                )
    except EmailAlreadyRegisteredError:
        print(f"{email} already has an account.", file=sys.stderr)
        return 1
    except WeakPasswordError:
        print("The identity provider refused that password.", file=sys.stderr)
        return 1
    except GoTrueError as exc:
        print(f"The identity provider refused: {exc}", file=sys.stderr)
        return 1
    finally:
        await database.dispose()

    print(f"Platform admin {admin.email} created, id {admin.id}. Sign in with the password set.")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parse_arguments(argv)
    return asyncio.run(
        run(
            email=arguments.email,
            full_name=arguments.full_name,
            password=read_password(),
            skip_confirmation=arguments.yes,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
