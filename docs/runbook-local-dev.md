# Runbook: local development

How to get the backend running on a fresh machine, either straight from `uv` or as containers.

Two things are always separate: the **Supabase CLI stack** (Postgres, GoTrue, Storage, Mailpit)
and **our backend processes** (the API and the worker). The stack is never containerized by us —
the CLI owns it. Only the API and the worker are containerized; the three portals run through
their Vite development servers.

## Prerequisites

- Docker, running
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [uv](https://docs.astral.sh/uv/) and Node (`.node-version`) with `pnpm`, for the non-container path

## 1. Start the stack

From the repo root:

```bash
supabase start
```

It applies everything in `supabase/migrations` to a fresh database. To reset it later:

```bash
supabase db reset
```

Read the generated URLs and keys at any time with:

```bash
supabase status            # human-readable
supabase status -o env     # ANON_KEY, SERVICE_ROLE_KEY, DB_URL, MAILPIT_URL, …
```

Two of those are needed below. Everything else has a working default.

| What                    | Where                                            |
| ----------------------- | ------------------------------------------------ |
| Postgres                | `127.0.0.1:54322` (`postgres` / `postgres`)      |
| Supabase API (Kong)     | `http://127.0.0.1:54321`                         |
| Mailpit (every email)   | `http://127.0.0.1:54324`                         |
| Studio                  | `http://127.0.0.1:54323`                         |

No email leaves the machine: GoTrue and the worker both deliver into Mailpit, which is where
confirmation links, invites and Communications are read during development.

## 2a. Run the processes with `uv`

The faster loop, and the one the tests use.

```bash
cd services/api
cp .env.example .env      # then fill the two keys from `supabase status -o env`
uv sync
uv run uvicorn sync_api.main:app --reload --port 8000
```

The worker is a second process:

```bash
cd services/api
uv run sync-worker
```

The API serves `http://127.0.0.1:8000`, with OpenAPI at `/docs` and `/openapi.json`.

## 2b. Run the processes as containers

```bash
cp .env.compose.example .env    # at the repo root, NOT services/api/.env
# fill SYNC_SUPABASE_ANON_KEY and SYNC_SUPABASE_SERVICE_ROLE_KEY from `supabase status -o env`
docker compose up --build
```

`compose.yaml` joins the stack's own Docker network (`supabase_network_sync1`, from `project_id`
in `supabase/config.toml`) and reaches it by container name, so the host's published ports are not
involved. `SYNC_DATABASE_URL` and `SYNC_SUPABASE_URL` are set there and belong in neither the root
`.env` nor your shell — inside that network the hostnames and ports differ from the host's.

Useful afterwards:

```bash
docker compose ps                     # `api` reports healthy once /v1/health/ready answers
docker compose logs -f api worker
docker compose up -d --build api      # rebuild one service
docker compose down
```

### The worker needs two API keys to start at all

The API degrades gracefully without them — search and match assessment answer `503`, everything
else works. The worker does not: it exits with `MissingApiKeyError` and, under compose's
`restart: unless-stopped`, crash-loops. Both keys are real third-party credentials, so there is no
local default.

| Key                    | Without it                                        |
| ---------------------- | ------------------------------------------------- |
| `SYNC_OPENAI_API_KEY`  | the worker refuses to start (CV parsing, embedding) |
| `SYNC_RESEND_API_KEY`  | the worker refuses to start (sending Communications) |

If you only need the API, run `docker compose up api`.

Leave a key you do not have **out of the file** rather than setting it empty. These are read
straight through into the process, and an empty value is a value: an empty `SYNC_OPENAI_API_KEY`
gets as far as the OpenAI client, which rejects it, instead of reading as "no key".

## 3. The web apps

```bash
pnpm install
pnpm dev
```

None of the portals requires a variable for local development. The recruiter landing offers the
Sync team's WhatsApp number and email from `VITE_CONTACT_WHATSAPP` and `VITE_CONTACT_EMAIL`; to
see those links, copy `apps/recruiter-portal/.env.example` to `.env.local`. Left unset, the
landing just offers no contact — nothing else changes.

`turbo run dev` starts the `dev` script of every workspace that has one: the candidate portal on
`127.0.0.1:5173`, the recruiter portal on `127.0.0.1:5174`, the Platform Portal on
`127.0.0.1:5175`, and — through the shim in `services/api/package.json` — `uvicorn` on `8000`.
So this covers 2a as well; the worker is the one process it does not start.

`SYNC_RECRUITER_PORTAL_URL` has to match the recruiter portal's address, because GoTrue will only
redirect an invite to a URL listed in `additional_redirect_urls` in `supabase/config.toml`.
`SYNC_ADMIN_PORTAL_URL` has to match the Platform Portal's address for Platform-admin password
reset links; both local portal URLs are listed in that allowlist. The Candidate and Recruiter
Portals use `VITE_ADMIN_PORTAL_URL` when their wrong-portal screen directs a Platform admin to the
Platform Portal. The Recruiter Portal also reads `VITE_CANDIDATE_PORTAL_URL` to build the
shareable address of a Job's Tracked links, so a copied link opens the Candidate Portal that
counts the view.

If the API is already running under compose, run only the portals so nothing fights over port 8000:

```bash
pnpm exec turbo run dev --filter='./apps/*'
```

## 4. Create a Platform admin

A Platform admin is the operator account that belongs to no Tenant — the one a Tenant is
created and suspended from, and the only one that can turn an access request into a Tenant.
Nobody self-serves a Tenant, so this account is how you get one at all: ask for access at the
recruiter portal's `/request-access`, then convert the request under **Access requests** in the
Platform Portal, and read the founding admin's invitation out of Mailpit.
There is no sign-up for a Platform admin: the first one has nobody to authorise
them, and a migration cannot make one because the auth user and its password belong to GoTrue,
not to the schema. A script does it, against whatever environment the `SYNC_*` settings point at:

```bash
cd services/api
uv run python scripts/create_platform_admin.py --email ops@sync.example --full-name "Nour Sabbagh"
```

It prints the target and asks before writing anything; `--yes` skips that. The password is typed
at the prompt, or read from `SYNC_PLATFORM_ADMIN_PASSWORD` where there is no terminal (CI, a
deploy shell). It is never an argument — those live on in shell history.

The account comes out already confirmed, so it can sign in immediately at the Platform Portal
(`http://127.0.0.1:5175` under `pnpm dev`). The Candidate and Recruiter Portals direct that account
to the Platform Portal from their wrong-portal screen.

Against a deployed environment, export that environment's `SYNC_DATABASE_URL`,
`SYNC_SUPABASE_URL` and `SYNC_SUPABASE_SERVICE_ROLE_KEY` first — the script reads exactly what the
API reads, `.env` included, so check which one it picked up before answering the prompt.

## 5. Tests

The suite drives the real stack, so it has to be running:

```bash
cd services/api
uv run pytest
```

It truncates and re-seeds every table between tests, so it will empty a database you were
clicking around in. `SYNC_TEST_SKIP_DB_RESET=1` skips the migration reset when iterating.

Tests that spend money or send are excluded by default; run them deliberately:

```bash
uv run pytest -m ai_live
uv run pytest -m email_live
```

## Images

Both images come out of one Dockerfile in the `uv` workspace, selected by stage:

```bash
docker build -f services/api/Dockerfile --target api    -t sync-api    services/api
docker build -f services/api/Dockerfile --target worker -t sync-worker services/api
```

Each installs only its own package (`uv sync --package sync-api` / `sync-worker`), so the worker
carries no web server. `--no-editable` puts our packages into the venv and the runtime stage
copies only `/app/.venv` — the images hold no source tree and run as a non-root `app` user.

## Troubleshooting

**`network supabase_network_sync1 not found`** — the stack is not running. `supabase start`.

**The API container is `unhealthy`** — `/v1/health/ready` runs `select 1`. Check the database is up
(`supabase status`) and that `SYNC_DATABASE_URL` still names `supabase_db_sync1:5432`.

**`required variable … is missing`** — the root `.env` has not been created. See 2b.

**Auth works over `curl` but not in the browser** — session cookies are `Secure` outside local
development. Compose sets `SYNC_AUTH_COOKIE_SECURE=false` for the API; the `uv` path reads it from
`services/api/.env`.

**A write returns 403 `csrf-header-required`** — browser-shaped requests must carry
`X-Sync-Request: 1`.
