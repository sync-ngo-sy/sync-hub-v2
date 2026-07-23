# The database defends itself; the Python backend owns trusted multi-step operations

Status: accepted

Multi-step business operations — application submission (writing `applications` + every
`application_*` snapshot + answers atomically), screening verdict writes, sending
communications, and the global-search projection — run in the Python backend
(`services/api`) with the Supabase **service role**, each as a single database
transaction. The database does **not** implement these as large PL/pgSQL
`SECURITY DEFINER` RPCs.

Instead the database is designed to defend its own invariants regardless of caller:
composite foreign keys for tenant isolation, `CHECK` constraints, and a small set of
invariant-critical triggers/functions (candidate XOR recruiter, embed-enqueue on profile
change, `updated_at`, screening-criteria lock). RLS governs direct client access.

## Rationale

The repo already has a structured Python backend (`core` / `api` / `worker` / `rag`).
Business logic is easier to version, test, and evolve there than in PL/pgSQL, and the goal
is a database that *accounts for* a backend working with it — not one that contains the
backend.

## Consequences

- Cross-row validations that can't be expressed as constraints (e.g. "every required
  question is answered") are enforced inside the backend transaction, not the database.
- The database still catches *structural* violations — wrong tenant, another candidate's
  CV, a `yes_no` answer with text — via constraints and composite FKs, so a backend bug
  cannot persist a structurally invalid application.
