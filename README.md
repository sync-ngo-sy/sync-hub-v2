# Sync Platform

A monorepo with three React apps and one Python backend, managed by Turborepo.

## What's inside

- `apps/candidate-portal`, `apps/recruiter-portal`, and `apps/admin-portal` — the React
  frontends for Candidates, Recruiters, and Platform admins.
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

# run everything (all three frontends + the API)
pnpm dev

# check the whole repo (JS + Python together)
pnpm typecheck
pnpm lint

# run just the backend
uv run --directory services/api uvicorn sync_api.main:app --reload

# drain the queue worker once — parses uploaded CVs (nothing triggers it locally)
uv run --directory services/api sync-worker drain

# fill the local stack with demo data (17 accounts across all three portals)
uv run --directory services/api python scripts/seed_demo.py

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

## Seeding demo data

Fill an empty local stack with usable data:

```bash
uv run --directory services/api python scripts/seed_demo.py
```

Three Tenants, nine Candidates, ten Jobs and nineteen Applications across every pipeline stage,
plus the Platform admin — so you don't need `scripts/create_platform_admin.py` locally. It asks
before writing and only runs against a local stack. `--purge` replaces an existing seed.

All 17 accounts share one password; the script prints them on every run, and they are listed in
[docs/demo-accounts.md](docs/demo-accounts.md).

## The queue worker

The backend is two deployable units: the FastAPI app, and a worker that drains the platform's
Postgres table queues — parsing uploaded CVs, building search embeddings, sending queued email.

**The worker does not run itself.** It no longer polls — it drains when something asks it to and
exits, so it can scale to zero. Locally nothing asks: the database webhook and the schedule that
call it when deployed don't exist on your machine. So an uploaded CV sits `pending` until you drain
by hand:

```bash
uv run --directory services/api sync-worker drain
```

That sweeps, drains every queue, prints what it did, and exits. Run it again after anything that
queues work — a CV upload, a profile edit, a queued email.

With no argument, `sync-worker` serves the drain endpoints on port 8080 instead, which is what the
container runs; it needs `SYNC_WORKER_SHARED_SECRET` or it answers 503.

### The keys it needs

Uploading a CV is the API's job and needs nothing extra; *parsing* it is the worker's, and
that needs an OpenAI key — as sending queued emails needs a Resend one:

```bash
# services/api/.env
SYNC_OPENAI_API_KEY=sk-...
SYNC_RESEND_API_KEY=re_...
```

Without them the worker won't start. The API reads neither key and the tests use fakes, so leaving
them unset is fine until you want a CV parsed or an email sent.

### Tests that call a real model

The suite parses with a deterministic fake, so a bare `pytest` costs nothing and hits no
provider. The handful of tests that exercise the real OpenAI adapter are marked `ai_live`
and excluded by default:

```bash
SYNC_OPENAI_API_KEY=sk-... uv run --directory services/api pytest -m ai_live
```

## The shared packages

These live in `packages/` and exist so the three apps don't duplicate code:

- **`@sync/ui`** — Shared buttons, components, and design (colors, spacing, fonts). Add a new component once here (`pnpm dlx shadcn@latest add <name>`), and every app can use it. No copy-pasting UI code between apps.

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

# SQLAlchemy models: same idea, for the Python side
supabase db reset
pnpm --filter @sync/api gen:models
```

Run these after backend/DB changes, then commit the updated generated files like any other code change.

`sync_core.models` is generated the same way `@sync/db-types` is — from the migrated schema, never hand-edited. Its relationships are all `viewonly`: navigate through them, but write by assigning foreign key columns, because the schema's composite tenant keys give most rows two paths to their tenant.

## Working on an issue

Issues live in [GitHub Issues](https://github.com/sync-ngo-sy/sync-hub-v2/issues).

### 1. Install the tools (once per machine)

| Tool | Install |
| --- | --- |
| Node 22+ | [nodejs.org](https://nodejs.org/en/download) |
| pnpm 11+ | [pnpm.io/installation](https://pnpm.io/installation) |
| uv | [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/) |
| Docker | [docs.docker.com](https://docs.docker.com/get-started/get-docker/) |
| Supabase CLI | [supabase.com/docs](https://supabase.com/docs/guides/local-development/cli/getting-started) |
| GitHub CLI | [cli.github.com](https://cli.github.com/) |

Then sign in:

```bash
gh auth login
```

Turborepo, Ruff, mypy and pytest come from the installs in step 2 — don't install them yourself. VS Code will offer the recommended extensions when you open the repo; optional.

### 2. Set the repo up (once per clone)

```bash
pnpm install
uv sync --directory services/api
cp services/api/.env.example services/api/.env   # git-ignored, so it does not exist yet
```

### 3. Start the stack (every session)

Start Docker first. The first run downloads several GB.

```bash
supabase start
supabase status
```

Paste two keys from `supabase status` into `services/api/.env`:

| `supabase status` | `services/api/.env` |
| --- | --- |
| Publishable | `SYNC_SUPABASE_ANON_KEY` |
| Secret | `SYNC_SUPABASE_SERVICE_ROLE_KEY` |

Leave every other line as it is. Add `SYNC_OPENAI_API_KEY` and `SYNC_RESEND_API_KEY` only when you run the worker (see [The queue worker](#the-queue-worker)).

### 4. Set up Claude Code

- Model: **Opus 5** (`/model`).
- Reasoning effort: **xhigh**.

### 5. Run it

```text
/implement issue 8 in a dedicated branch, if you encounter any blockers stop and tell me
```

Change the issue number.

### 6. Check before you accept it

```bash
pnpm typecheck
pnpm lint
pnpm --filter @sync/api test   # needs the stack from step 3 running
```

All three must pass, then read the diff.
