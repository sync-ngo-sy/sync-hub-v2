# Platform operations live in a third application

Platform-admin operations live in `apps/admin-portal`, a third React application rather than a
section of the Recruiter Portal. It owns Platform-admin authentication routes, the platform
overview, and Tenant operations, while using the generated API client and the data-free design
system shared by the other portals.

Platform administrators operate Sync across Tenants; Recruiters operate one Tenant. Putting the
operator screens in the Recruiter Portal would blur that authority boundary, ship privileged
features in the tenant-facing bundle, and make its navigation imply that platform work belongs to
a Tenant. A route guard inside that app would still need the same role checks, but would not make
the product boundary clear. The Candidate Portal is also not a fit because its audience is
Candidates, not operators.

The application is a separately gated service boundary. Deployment, including its provider
hostname and runtime configuration, remains infrastructure work outside this decision and is
separately gated by parent issue #137; this ADR does not introduce deployment configuration.

## Consequences

- Local development serves the Platform Portal on `127.0.0.1:5175`.
- `SYNC_ADMIN_PORTAL_URL` is the API's canonical target for Platform-admin password-reset links;
  `VITE_ADMIN_PORTAL_URL` is the Candidate and Recruiter Portals' target for Platform-admin
  wrong-portal links.
- The Platform Portal continues to call the API only through `@sync/api-client` (ADR-0008), and
  its shared UI stays data-free (ADR-0009).
- Operator features remain outside the Candidate and Recruiter Portal bundles.
