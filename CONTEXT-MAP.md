# Context Map

Multi-context monorepo. Each workspace package and `supabase/` is its own context.
`CONTEXT.md` files are created lazily, as the terms in each context get resolved — so
most contexts below don't have one yet.

## Contexts

- [Database](./supabase/CONTEXT.md) — the Postgres schema: identity, tenancy, the
  recruitment domain tables, and the invariants the database enforces on its own
  (constraints, RLS, trusted RPCs).
- [Candidate Portal](./apps/candidate-portal/CONTEXT.md) — the candidate-facing web
  app: browsing and applying to Jobs, CVs, the professional profile, Applications.
- [Recruiter Portal](./apps/recruiter-portal/CONTEXT.md) — the tenant-facing web app:
  Jobs, the application Pipeline, the tenant CRM, and team management.
- [Platform Portal](./apps/admin-portal/CONTEXT.md) — the Platform-admin web app:
  platform counts and Tenant operations.
- [Design System](./packages/ui/CONTEXT.md) — the shared visual language of all three
  portals: tokens, primitives, and molecules that render purely from props.

Not yet modelled (no `CONTEXT.md` until their terms are resolved):
`packages/api-client`, `packages/db-types`, `services/api`.

## Relationships

- **services/api → Database**: the API is the only "trusted" writer for applications,
  screening verdicts, communications and CV parsing state. The database is designed to
  defend its invariants even so (composite FKs + RLS + constraints), not to trust the
  backend blindly.
- **Database → packages/db-types**: `db-types` is generated from the live schema; the
  database is the source of truth.
- **services/api → packages/api-client**: the client is generated from the API's
  OpenAPI schema; the API is the source of truth (see ADR-0008).
- **Portals → services/api**: all three portals speak to the backend only through
  `packages/api-client` — never raw HTTP (ADR-0008).
- **Design System → Portals**: all three portals render from the shared design system;
  the design system itself never fetches data (ADR-0009).
