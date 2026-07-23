# Lean shared-PK identity; one tenant per recruiter; candidate XOR recruiter

Status: accepted

We key `profiles`, `candidates`, and `recruiters` on the same id as the Supabase Auth
user (shared primary key), and give each Recruiter a single `tenant_id`. This keeps RLS
trivial (`auth.uid() = <owner>_id`) for the MVP, at the cost that one human cannot recruit
for more than one tenant.

A Profile is a Candidate **XOR** a Recruiter, enforced declaratively (not by trigger):
`profiles` carries an `account_type` discriminator with `UNIQUE (id, account_type)`, and
each child table pins its own constant `account_type` via CHECK and references
`profiles(id, account_type)` with a composite FK. The opposite child row is then
physically unreferenceable — race-free, no cross-table trigger.

## Considered options

- **Membership table** (a recruiter belongs to many tenants) — rejected for the MVP: it
  taxes every recruiter RLS policy with a membership lookup + active-tenant context.
  Revisit if agency / multi-client recruiting is ever added.
- **Cross-table exclusivity triggers** — rejected: racy without explicit locking; the
  composite-FK discriminator achieves the same guarantee declaratively.

## Consequences

- A person who both job-hunts and recruits needs two separate accounts (two emails).
- Going multi-tenant-recruiter later means breaking the shared PK, adding a membership
  table, and rewriting every recruiter-scoped RLS policy — a bounded but real migration.
