# Data access is SQLAlchemy 2.0 async on a direct Postgres connection; supabase-py is only for GoTrue and Storage

Status: accepted

The backend's data path is SQLAlchemy 2.0 (async, typed `Mapped[]` style) over asyncpg,
connecting straight to Postgres with the service role. `supabase-py` remains a dependency
solely as an HTTP client for GoTrue (admin user creation, invites, password grant) and
Storage (uploads, signed download URLs) — it never reads or writes application tables.

**Amended when ADR-0005's auth proxy was built.** Two notes on the GoTrue half:

- `supabase-py` *is* the GoTrue client (`sync_api.auth.gotrue`), but a client is constructed
  per call rather than once per process. `AsyncGoTrueClient` models a browser holding one
  session — signing in stores it on the instance — so a shared instance would end up holding
  whoever signed in last, and any call reading that stored session instead of an explicit
  argument would act as them. Per-call construction is an allocation over the process's own
  `AsyncClient`, not a connection.
- Access-token verification does **not** use `client.auth.get_claims()`; it uses PyJWT's
  `PyJWKClient` (`sync_api.auth.tokens`). `get_claims` treats HS256 as a special case and
  validates it by calling GoTrue over the network, and a Supabase project keeps a legacy
  shared HS256 secret that GoTrue still honours — probed against this repo's own stack, a
  token forged with that secret and no `kid` is **accepted**. It also checks neither `iss`
  nor `aud`, and its network fallback is the per-request hop ADR-0005 chose JWKS to avoid.

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
