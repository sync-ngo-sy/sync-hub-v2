# Data access is SQLAlchemy 2.0 async on a direct Postgres connection; supabase-py is only for GoTrue and Storage

Status: accepted

The backend's data path is SQLAlchemy 2.0 (async, typed `Mapped[]` style) over asyncpg,
connecting straight to Postgres with the service role. `supabase-py` remains a dependency
solely as an HTTP client for GoTrue (admin user creation, invites, password grant) and
Storage (uploads, signed download URLs) — it never reads or writes application tables.

**Amended when ADR-0005's auth proxy was built.** Two notes on the GoTrue half:

- `supabase-py` *is* the GoTrue client (`sync_api.auth.gotrue`), and the flows construct one
  per call rather than once per process. `AsyncGoTrueClient` models a browser holding one
  session — signing in stores it on the instance — so a shared instance would end up holding
  whoever signed in last, and any call reading that stored session instead of an explicit
  argument would act as them. Per-call construction is an allocation over the process's own
  `AsyncClient`, not a connection.
- Access-token verification is the SDK's `get_claims()` too, and is the one place holding a
  client for the life of the process (`sync_api.auth.tokens`): the SDK caches the JWKS on
  the client that fetched it, and it reads only the token it is handed, so there is no
  stored session to confuse. Ours is the adapter around it — the claims the API acts on,
  and one error for every refusal.

**Amended for the Cloud Run deployment.** Deployed environments connect through Supabase's
Supavisor pooler in transaction mode, not straight to Postgres. Compute scales to many
short-lived instances and each one's own pool multiplies into the database's connection
limit; the pooler is what bounds that. "Direct" in the title now means "not through
PostgREST", not "not through a pooler".

The consequence is asyncpg-specific and not obvious. Transaction-mode pooling gives each
transaction whichever server connection is free, so a statement prepared on one is missing
from the next, and two clients sharing a connection collide on the same generated statement
name. `sync_core.db` therefore disables the dialect's prepared-statement cache — a URL query
parameter, because the engine keyword is rejected — disables asyncpg's own cache, and gives
every statement a unique name. Failures without this are intermittent and only appear under
concurrency, which is why the pooled path is exercised directly in
`tests/integration/test_transaction_pooler.py` rather than trusted to configuration.

The forcing fact: ADR-0001 makes multi-row single-transaction writes (application
submission, PII scrub, chunk swaps) and `SELECT … FOR UPDATE SKIP LOCKED` queue claims the
backend's job — and supabase-py speaks PostgREST, which has no client-side transactions at
all. A Supabase project that shuns the Supabase data client looks wrong until you know
this.

Model classes are generated with `sqlacodegen` from the migrated schema and checked in —
the same "database is the source of truth" pattern as `packages/db-types`. No Alembic; the
schema is owned by `supabase/migrations/`.

## Considered options

- **supabase-py for everything** — impossible, not just inelegant: no transactions, no
  row locking, no `FOR UPDATE SKIP LOCKED`.
- **Raw asyncpg + Pydantic** — maximum SQL control, but hand-rolled CRUD for ~40 tables
  and no static typing across refactors.
- **SQLModel** — its model-as-DDL premise is dead weight when SQL migrations own the
  schema; lags SQLAlchemy 2.0 features.
