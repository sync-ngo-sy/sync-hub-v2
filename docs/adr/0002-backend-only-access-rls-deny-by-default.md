# Backend-only data access; RLS is deny-by-default defense-in-depth

Status: accepted

Frontends access application data **only** through the Python API (`services/api`). There
is no direct browser → Supabase (PostgREST) data path — the apps ship no Supabase client.
The API verifies the Supabase Auth JWT and performs all data access with a role that
bypasses RLS (the service role).

RLS is therefore **not** the primary authorization layer — the API is. But we still
`ENABLE` row-level security on every table in the `public` schema, with **no policies**
granted to `anon` or `authenticated`, and we `REVOKE` their grants outright. A leaked
anon/authenticated key hitting PostgREST directly returns zero rows. The DBML's detailed
per-table RLS intent becomes the authorization specification the API implements in code.

Enabled, and deliberately **not** `FORCE`d. `FORCE` subjects a table's owner to its own
policies, and with no policies at all that means the owner reads and writes nothing —
which is the role this bundle's own migrations run as, so migration 11's reference-data seed
would be the first thing it broke. `FORCE` would only matter if a client role ever *owned* a
`public` table, and none does: ownership stays with `postgres`, and the trusted backend is
`service_role`, which bypasses RLS by being `BYPASSRLS` rather than by owning anything. So
forcing buys no defence here and costs the ability to migrate.

`tests/integration/test_row_level_security.py` is the check: every `public` table has RLS enabled, no
table has a policy, and neither client role holds a grant on any of them. A new table that
forgets `enable row level security` fails it — which is the failure mode worth catching,
because migration 09 enables RLS by looping over the tables that existed when it ran, and
every table added after it enables its own.

## Considered options

- **Hybrid direct-client + API** (idiomatic Supabase) — rejected for now: the frontends
  have no Supabase client, and centralizing authorization in the API is easier to get
  right and test than ~40 tables of policies. Revisit if direct client access is added.
- **`FORCE ROW LEVEL SECURITY` as well** — rejected for the reason above: it locks the
  migrating role out of its own schema and defends against a case that does not exist.

## Consequences

- Every new `public` table must have RLS enabled (deny-by-default), and the test named
  above is what says so rather than convention alone.
- Supabase Auth still issues JWTs. Storage buckets (CV files) get their own access rules,
  handled separately from table RLS.
- Adding direct client reads later means adding policies incrementally — no rework of the
  API. It also means revisiting `FORCE`, because a policy that exists is a policy an owner
  could be held to.
