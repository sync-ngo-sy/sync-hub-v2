# Auth is fully API-proxied with httpOnly cookie sessions; SPAs never talk to Supabase

Status: accepted

All auth traffic flows through the Python API — `/v1/auth/signup`, `/login`, `/refresh`,
`/logout`, confirmation and password reset. The backend calls GoTrue (admin create-user at
signup, password grant at login) and sets the Supabase access/refresh tokens as httpOnly
cookies. Per-request verification is local JWKS JWT validation (no network hop). The SPAs
ship no Supabase client and no Supabase URL — extending ADR-0002's backend-only stance
from data to identity.

Why: signup is not just a GoTrue call here — the backend must atomically provision
`profiles` + `candidates`/`recruiters` (and for recruiter signup, the `tenants` row), and
"the flow decides the role". Splitting auth across two authorities (browser→GoTrue for
login, API for provisioning) would leave a two-phase signup that can strand half-created
identities, and put tokens in JS-readable storage. Cookies also give XSS-resistant
sessions for free; CSRF is handled with SameSite plus a custom-header requirement.

Tenant onboarding is self-serve (public recruiter signup creates tenant + admin);
teammates join by invite-as-provisioning: GoTrue invite email + immediate
`profiles`/`recruiters` rows, so no invitations table exists — deliberately.

## Consequences

- Social OAuth later requires a browser↔GoTrue redirect flow that partially bypasses the
  proxy — accepted; email/password + confirmation + reset is the MVP scope.
- Email confirmation is required before candidate login, keeping `auth.users` emails
  trustworthy for the communications sender (which resolves recipients from `auth.users`).
