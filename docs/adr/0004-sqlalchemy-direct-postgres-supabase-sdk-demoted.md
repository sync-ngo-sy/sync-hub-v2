# Data access is SQLAlchemy 2.0 async on a direct Postgres connection; supabase-py is only for GoTrue and Storage

Status: accepted

The backend's data path is SQLAlchemy 2.0 (async, typed `Mapped[]` style) over asyncpg,
connecting straight to Postgres with the service role. `supabase-py` remains a dependency
solely as an HTTP client for GoTrue (admin user creation, invites, password grant) and
Storage (uploads, signed download URLs) — it never reads or writes application tables.

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
