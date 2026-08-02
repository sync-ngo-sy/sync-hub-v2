# Recruiter Portal

The tenant-facing web app: publishing Jobs, reviewing Applications, working the tenant
CRM (talent pool, notes, tags), and managing the team. Domain vocabulary (Tenant,
Recruiter, Job, Application, Screening, Tracked link…) is inherited from the
[Database context](../../supabase/CONTEXT.md) and never redefined here.

## Language

**Landing page**:
The public page at the portal's root that explains the platform to companies and offers
contact (WhatsApp, email) and workspace sign-up. One of the two surfaces where animation
is allowed (the other is the Candidate Portal's landing page).
_Avoid_: Home page, marketing site.

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

**Wrong-portal screen**:
The full-page notice shown when a signed-in Profile this portal does not serve opens it. It
names the account type they are signed in with, and the portal they should be in — a Candidate
is pointed at the Candidate Portal and a Platform admin at the Platform Portal.
_Avoid_: 403 page, forbidden page.
