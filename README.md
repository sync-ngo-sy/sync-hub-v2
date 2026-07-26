# Sync Platform

A monorepo with two React apps and one Python backend, managed by Turborepo.

## What's inside

- `apps/candidate-portal` and `apps/recruiter-portal` — the two React frontends.
- `packages/` — code shared between the frontends (see below).
- `services/api` — the Python (FastAPI) backend, managed by `uv`.
- `supabase/` — the database config.

## VS Code extensions

Open the repo and VS Code will suggest installing these (from `.vscode/extensions.json`):

- **Biome** — formats and lints all the JS/TS code.
- **Ruff** — formats and lints all the Python code.
- **Python + Pylance** — Python language support.

Install them, and formatting on save + linting just works, for both languages.

## How Python finds the right `.venv`

The Python backend has **one shared virtual environment** for all its packages, at `services/api/.venv`. Normally you'd have to activate it by hand. Instead, `.vscode/settings.json` has this line:

```json
"python.defaultInterpreterPath": "${workspaceFolder}/services/api/.venv/bin/python"
```

This tells VS Code "always use this Python" automatically, so imports resolve and Pylance works without you ever running `source .venv/bin/activate`. When running commands yourself in the terminal, use `uv run` instead of activating — see commands below.

## Most important commands

```bash
# install everything
pnpm install
uv sync --directory services/api
cp services/api/.env.example services/api/.env   # then fill in from `supabase status`

# run everything (both frontends + the API)
pnpm dev

# check the whole repo (JS + Python together)
pnpm typecheck
pnpm lint

# run just the backend
uv run --directory services/api uvicorn sync_api.main:app --reload

# run the backend's tests (needs `supabase start` first — see below)
pnpm --filter @sync/api test
```

`pnpm dev`, `pnpm lint`, and `pnpm typecheck` are Turborepo commands — Turbo runs the same command across every app/package in one shot (and caches results, so repeat runs are fast). The Python backend is included too, through a small `package.json` shim that just calls `uv` under the hood.

## Testing the backend

The API's tests run against the **real** local Supabase stack — the actual Postgres with the actual migrations, triggers and constraints, plus GoTrue and Storage. Nothing is mocked, so start the stack first:

```bash
supabase start
pnpm --filter @sync/api test
```

Each session begins with a `supabase db reset`, and each test starts from an empty database with the reference data (languages, the Canonical skill taxonomy) reseeded. That reset costs ~40 s; while iterating on a single test you can skip it:

```bash
SYNC_TEST_SKIP_DB_RESET=1 uv run --directory services/api pytest tests/test_health.py
```

The suite reads the stack's URL and keys from `supabase status`, so it works regardless of what `services/api/.env` says.

## Calling the API from a frontend

Auth is fully proxied by the backend (ADR-0005) — the apps ship no Supabase client and
never see a token. Two things follow for anything calling the API from the browser:

- **Send cookies.** The session lives in httpOnly cookies the API sets on sign-in, so
  requests need `credentials: 'include'` (or `withCredentials`). Nothing readable from
  JavaScript identifies the user; ask `GET /v1/auth/me` instead.
- **Send `X-Sync-Request` on anything that changes data.** Any value. A cross-site form
  cannot add a header, which is what — together with `SameSite` — stops another origin
  forging a request with your session attached. Requests without it are refused with 403.

The confirmation and password-reset emails link into the candidate portal
(`/auth/confirm` and `/auth/reset-password`, from `supabase/templates/`), carrying a
`token_hash` in the query string. Those pages post the token to `POST /v1/auth/confirm-email`
and `POST /v1/auth/password-reset/confirm` — the browser never talks to Supabase.

Teammate invites work the same way but land in the **recruiter** portal, at
`/auth/accept-invite`, which posts the token plus a chosen password to
`POST /v1/auth/accept-invite`. That URL comes from `SYNC_RECRUITER_PORTAL_URL`, and it has
to be listed in `additional_redirect_urls` in `supabase/config.toml` — GoTrue silently
falls back to `site_url` (the candidate portal) for any redirect it does not recognise.

## The shared packages

These live in `packages/` and exist so the two apps don't duplicate code:

- **`@sync/ui`** — Shared buttons, components, and design (colors, spacing, fonts). Add a new component once here (`pnpm dlx shadcn@latest add <name>`), and both apps can use it. No copy-pasting UI code between apps.

- **`@sync/api-client`** — A typed client for talking to the backend. It's generated straight from the FastAPI backend's schema, so if the backend changes, TypeScript will immediately show an error anywhere the frontend used the old shape. No guessing what an API call returns.

- **`@sync/db-types`** — TypeScript types generated from the actual Supabase database. Same idea: the database is the source of truth, and the types just follow it automatically.

### Regenerating them

These files don't update on their own. Whenever a FastAPI route or a database table changes, regenerate the types by hand:

```bash
# api-client: needs the backend running (reads its live schema at :8000)
uv run --directory services/api uvicorn sync_api.main:app --reload   # terminal 1
pnpm gen:api-client                                                   # terminal 2

# db-types: needs Supabase running locally
supabase start
pnpm gen:db-types

# SQLAlchemy models: same idea, for the Python side (ADR-0004)
supabase db reset
pnpm --filter @sync/api gen:models
```

Run these after backend/DB changes, then commit the updated generated files like any other code change.

`sync_core.models` is generated the same way `@sync/db-types` is — from the migrated schema, never hand-edited. Its relationships are all `viewonly`: navigate through them, but write by assigning foreign key columns, because the schema's composite tenant keys give most rows two paths to their tenant.
