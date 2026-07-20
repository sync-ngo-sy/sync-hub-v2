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

# run everything (both frontends + the API)
pnpm dev

# check the whole repo (JS + Python together)
pnpm typecheck
pnpm lint

# run just the backend
uv run --directory services/api uvicorn sync_api.main:app --reload
```

`pnpm dev`, `pnpm lint`, and `pnpm typecheck` are Turborepo commands — Turbo runs the same command across every app/package in one shot (and caches results, so repeat runs are fast). The Python backend is included too, through a small `package.json` shim that just calls `uv` under the hood.

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
```

Run these after backend/DB changes, then commit the updated generated files like any other code change.
