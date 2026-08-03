# Recruiter Portal

The tenant-facing web app: publishing Jobs, reviewing Applications, working the tenant
CRM (talent pool, notes, tags), and managing the team. Domain vocabulary (Tenant,
Recruiter, Job, Application, Screening, Tracked link…) is inherited from the
[Database context](../../supabase/CONTEXT.md) and never redefined here.

## Language

**Landing page**:
The public page at the portal's root that explains the platform to companies and offers
contact (WhatsApp, email) and a way to ask for access. It offers no workspace sign-up: Sync is
sold, not self-served, so every call to action points at the Access-request page. One of the two
surfaces where animation is allowed (the other is the Candidate Portal's landing page).
_Avoid_: Home page, marketing site.

**Access-request page**:
The public page at `/request-access` where a visitor leaves their company, their name and their
address, and is told the request was received. The one unauthenticated write this portal makes.
`/signup` is kept as a redirect to it, because that address was published. Creating an account
here is impossible — a Platform admin converts the request, and the founding admin arrives by
invitation.
_Avoid_: Sign-up page, contact form, waitlist.

**Workspace**:
Everything behind the sign-in guard — the Tenant's own Sync, reached through the
sidebar. Routes live under the `_workspace` layout, whose guard is the single place a
Profile is checked before any of its loaders run.
_Avoid_: App, dashboard area, admin.

**Dashboard**:
The signed-in Recruiter's home: an overview of the Tenant's hiring activity. One
destination inside the Workspace, not a name for the Workspace itself.
_Avoid_: Home, overview page.

**Pipeline**:
The ordered application statuses a Recruiter moves an Application through while
reviewing it. Distinct from Screening, which is the automated verdict.
_Avoid_: Funnel, workflow, stages.

**Triage list**:
A Job's Applications, newest first, under the Job's Applications tab — the surface a Recruiter
works from before opening anything. Each row carries the Screening verdict and the Pipeline
status side by side, because the two answer different questions and neither substitutes for the
other. Both are filters, they combine, and they live in the address bar rather than in the page,
so a reload keeps them and a pasted link reproduces the list it was copied from. The list is
paged by cursor and never sorted in the browser: the API decides the order.
_Avoid_: Applicants list, candidate list (a Candidate is a person; a row here is an Application).

**Reference data**:
The platform's fixed lists — Canonical skills with their categories, languages with their
names and codes, and Locations under their heading — read from endpoints of their own and
held for the session. A Job's screening criteria pick skills and languages from these
rather than taking typed answers, so a Recruiter states a requirement in the same words a
Candidate states a skill, which is what makes the two comparable; a Job's Location is
picked the same way, from the list a Candidate picks theirs from. Each list is small
enough to fetch whole and filter in the browser; nothing is searched server-side, and a
picker shows a language's name while the criteria store its code — the same for a
Location, which reads as its name and is stored as its key.
_Avoid_: Lookups, master data, enums (an enum reaches the portals through the generated
client; these are rows).

**Placeholder vocabulary**:
The `{{ … }}` names a Message template may use — `candidate_name`, `job_title`,
`tenant_name` — which one send fills with this Candidate, this Job and this Tenant. The
backend owns the set and refuses an unfillable name at save time, but it publishes no list
of them, so this portal carries its own copy: the template editor has to name the three in
its help text before a Recruiter can use them, and once the list is here, refusing a bad
one beside the field costs nothing. Unlike Reference data, this is a mirrored constant
rather than rows — if the platform ever adds a placeholder, this copy is the one thing that
does not learn about it, and the API's refusal is the backstop that still lands under the
right field.
_Avoid_: Merge fields, variables, tokens.

**Wrong-portal screen**:
The full-page notice shown when a signed-in Profile this portal does not serve opens it. It
names the account type they are signed in with, and the portal they should be in — a Candidate
is pointed at the Candidate Portal and a Platform admin at the Platform Portal.
_Avoid_: 403 page, forbidden page.
