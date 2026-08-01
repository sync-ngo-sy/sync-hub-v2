# API Test Suite Structure Design

## Goal

Reduce the backend test suite's avoidable database-cleanup time without deleting tests or changing the meaning of `pytest`, `pnpm test`, or the CI API test command.

## Design

Split API tests by dependency:

- `tests/unit/` contains tests that exercise synchronous application or domain logic and require no local Supabase services.
- `tests/integration/` contains tests that exercise the ASGI application, Postgres, GoTrue, Storage, or Mailpit.
- `tests/support/` remains shared test code imported by integration tests.

The Supabase environment, migration reset, database connections, application clients, and per-test clean-slate fixtures move from `tests/conftest.py` to `tests/integration/conftest.py`. Pytest discovers that file only for integration descendants, so unit tests no longer truncate and reseed 43 tables.

The existing pytest `testpaths = ["tests"]` setting remains unchanged. Consequently, `uv run pytest`, the API package's `pnpm test`, the repository's Turbo-driven `pnpm test`, and the CI workflow continue to collect the complete suite.

## Scope

Only test modules proven to pass with `--noconftest` move into `tests/unit/`. All other test modules move into `tests/integration/` without changing their test bodies. No production code, dependencies, pnpm scripts, pytest options, or CI workflow steps change.

## Verification

- A unit test module must pass when `supabase` is absent from `PATH`.
- The integration smoke tests must pass with the local stack.
- Full `uv run pytest` must preserve the selected test count and pass.
- Root `pnpm test` must pass, proving the existing package scripts and Turbo graph still work.
