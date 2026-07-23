# Context Map

Multi-context monorepo. Each workspace package and `supabase/` is its own context.
`CONTEXT.md` files are created lazily, as the terms in each context get resolved — so
most contexts below don't have one yet.

## Contexts

- [Database](./supabase/CONTEXT.md) — the Postgres schema: identity, tenancy, the
  recruitment domain tables, and the invariants the database enforces on its own
  (constraints, RLS, trusted RPCs).

Not yet modelled (no `CONTEXT.md` until their terms are resolved):
`apps/candidate-portal`, `apps/recruiter-portal`, `packages/api-client`,
`packages/db-types`, `packages/ui`, `services/api`.

## Relationships

- **services/api → Database**: the API is the only "trusted" writer for applications,
  screening verdicts, communications and CV parsing state. The database is designed to
  defend its invariants even so (composite FKs + RLS + constraints), not to trust the
  backend blindly.
- **Database → packages/db-types**: `db-types` is generated from the live schema; the
  database is the source of truth.
