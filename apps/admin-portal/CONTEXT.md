# Platform Portal

The Platform-admin web app: the place where Sync operators inspect platform counts, work the
Access-request queue, and operate Tenants. Domain vocabulary (Platform admin, Tenant, Recruiter,
Access request…) is inherited from the
[Database context](../../supabase/CONTEXT.md) and never redefined here.

## Language

**Platform Portal**:
The app served to Platform admins, separate from the Candidate and Recruiter Portals. Its
authenticated routes live under the `_admin` layout, which is the only place a Profile is checked
before an operational screen loads.
_Avoid_: Recruiter admin, back office, control panel.

**Platform overview**:
The Platform admin's home at `/overview`: counts of Tenants, Candidates, Jobs, and Applications.
It is a read-only indication of the platform's scale, not a Tenant dashboard or an analytics
workspace.
_Avoid_: Dashboard, reporting, metrics suite.

**Tenant operations**:
The Platform Portal's work at `/tenants`: reading the platform's Tenants, creating a Tenant and
its founding admin invitation, resending a pending founding-admin invitation, and suspending or
restoring a Tenant. A status change must explain its access and job-board consequences before it
is confirmed; a plan is display-only.
_Avoid_: Tenant CRM, account management, billing.

**Access-request queue**:
The Platform Portal's work at `/access-requests`: the companies that have asked to be let onto
Sync, oldest first, with the two decisions that empty it — converting one into a Tenant, or
dismissing it. Converting retypes nothing: the company, the founding admin and their address all
come off the request, and the Tenant's address is the only thing the operator supplies (offered
pre-filled from the company name). This is where Tenants normally come from; the Create-tenant
form under Tenant operations is for the company that never asked here.
_Avoid_: Inbox, leads, sign-up queue, applications.

**Wrong-portal screen**:
The full-page notice shown when a Candidate or Recruiter opens the Platform Portal. It identifies
the signed-in account type and offers only a way out, because those account types are not served
here.
_Avoid_: 403 page, forbidden page.
