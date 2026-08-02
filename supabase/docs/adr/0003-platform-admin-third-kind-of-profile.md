# A Platform admin is a third kind of Profile

Status: accepted

Amends ADR-0001, whose title and body assert candidate XOR recruiter.

Sync is sold, not self-served, so somebody has to run the platform: create a Tenant, invite
its founding admin, suspend one that stops paying. That operator belongs to no Tenant, and
is not a job seeker either. We give them a **Platform admin**: a third value of the
`account_type` discriminator and a `platform_admins` table keyed on the Profile id, on
exactly the shared-primary-key pattern `candidates` and `recruiters` already use — a
constant `account_type` pinned by CHECK, and a composite FK to `profiles (id,
account_type)`.

The change is purely additive. Every existing constraint keeps the meaning it had: the
composite FK still makes each of the other two child rows physically unreferenceable, so a
Profile is still **exactly one** kind — the count went from two to three, the exclusivity
did not weaken.

A Platform admin is not a Recruiter whose `role` is `admin`. That role is authority inside
one Tenant; this is an account outside every Tenant. The two are unrelated, and the
glossary says so.

The first Platform admin is made by `services/api/scripts/create_platform_admin.py`, run
against a target environment. A migration cannot do it — the auth user and its password
belong to the identity provider, not to the schema — and an endpoint cannot either, because
the first one has nobody to authorise them.

## Considered options

- **A boolean flag on `profiles`** — rejected: it makes "operator" a property a Candidate or
  a Recruiter could also carry, which is the one thing the discriminator exists to prevent.
  Every guard would then have to check two columns instead of one.
- **A separate auth realm, outside `profiles`** — rejected for the MVP: sign-in, sessions,
  password reset and the wrong-portal notice all already work off one Profile shape, and a
  second realm would fork every one of them for a handful of accounts.
- **A Recruiter of a special "platform" Tenant** — rejected: it would make the operator a
  member of a customer-shaped workspace, and every tenant-scoped query would need an
  exception for the one Tenant that is not a customer.

## Consequences

- Guards are three-way. A Platform admin is refused every Candidate-only and every
  Tenant-scoped route by the same account-type check that already refused the other two,
  and Platform-admin-only surfaces refuse a Candidate and a Recruiter through
  `acting_platform_admin`.
- Neither portal serves the account type, so a Platform admin signing in to either lands on
  the existing wrong-portal notice, which now names their account type rather than
  guessing.
- One human who both operates the platform and recruits still needs two accounts — the
  consequence ADR-0001 already accepted, now with one more kind to it.
