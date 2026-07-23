# Backend-only data access; RLS is deny-by-default defense-in-depth

Status: accepted

Frontends access application data **only** through the Python API (`services/api`). There
is no direct browser → Supabase (PostgREST) data path — the apps ship no Supabase client.
The API verifies the Supabase Auth JWT and performs all data access with a role that
bypasses RLS (the service role).

RLS is therefore **not** the primary authorization layer — the API is. But we still
`ENABLE` and `FORCE` row-level security on every table in the `public` schema, with **no
policies** granted to `anon` or `authenticated`. A leaked anon/authenticated key hitting
PostgREST directly returns zero rows. The DBML's detailed per-table RLS intent becomes the
authorization specification the API implements in code.

## Considered options

- **Hybrid direct-client + API** (idiomatic Supabase) — rejected for now: the frontends
  have no Supabase client, and centralizing authorization in the API is easier to get
  right and test than ~40 tables of policies. Revisit if direct client access is added.

## Consequences

- Every new `public` table must have RLS enabled (deny-by-default); enforce via convention
  and a migration/lint check.
- Supabase Auth still issues JWTs. Storage buckets (CV files) get their own access rules,
  handled separately from table RLS.
- Adding direct client reads later means adding policies incrementally — no rework of the
  API.
