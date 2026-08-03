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

**Application review**:
The page one Application is read on, reached from the Triage list or from its own address —
the Snapshot and the answers on the left, and on the right the things a Recruiter acts on or
against: the Pipeline, the Screening verdict, the CV, and the history. It reads the Snapshot
rather than the Candidate's live profile, and says so on the page, because the two can differ
and only one of them is what was reviewed. The CV's link is short-lived and never stored: the
page re-reads the Application instead of holding on to it.
_Avoid_: Application detail, candidate page, applicant profile.

**Pipeline move**:
One named action on the Application review, offered only where the platform allows it from
where the Application stands — so the buttons on screen are the moves that exist, and the
current status sits above them. A move forward or back is named for its stage, a decision for
the decision ("Mark as hired", "Reject"), and each says in its outcome toast that the candidate
was told, because every move notifies them and a rejection also emails them. Withdrawing is
never offered: that is the Candidate's alone.
_Avoid_: Status change, transition, stage update.

**Refused move**:
A Pipeline move the API answers with a 409, rendered where the buttons are rather than as a
toast or a page-wide banner — the reason belongs beside the thing that caused it, and the
Application has not moved, so the rest of the page is still true. The wording is the server's:
it owns the rule, and the portal's own sentence is only the fallback for a refusal that
explains nothing.
_Avoid_: Invalid transition error, move failure.

**Notes widget**:
The Application review's team memory: a box to write in, and under it what the team has already
written, newest first. Each note carries the Recruiter who wrote it and how long ago, and says
"edited" and re-dates itself when somebody rewrites it — a note belongs to the Tenant, so any
Recruiter may rewrite or delete any of them, and the byline stays whoever wrote it first. Nothing
is patched in the browser after a write: the author and both timestamps are the server's to write,
so the widget re-reads what it has just changed. Older notes arrive only when they are asked for.
Deleting asks first, because the words are the only copy.
_Avoid_: Comments, activity feed, internal messages (a Message goes to the Candidate; a note never
leaves the Tenant).

**Tag picker**:
The one control on the Application review that does both halves of filing: it lists the Tenant's
application-scoped vocabulary to toggle a Tag on or off, and offers to mint the word the Tenant
does not have yet from whatever has been typed. Creating reads as one act although it is two on
the wire, and the two are told apart when only the first lands: a Tag that was minted stays in the
vocabulary even if the Application could not then be filed under it, so the picker offers the word
rather than offering to create it a second time — which the API would refuse as a name already
taken. Only application-scoped Tags are ever offered, because a candidate-scoped one is a refusal
the picker should not be able to ask for, and a part-match is still a new word: "Arab" is not
"Arabic", and only the Recruiter knows which they meant. The Tags already on show as removable
chips beside it, so taking one off never needs the picker opened.
_Avoid_: Labels, categories, keywords.

**Independent widget**:
A card on a page that reads its own endpoint, and fails and retries without the page failing —
the notes and the Tags on the Application review are both this. The refusal lands inside the card,
with its own Retry, while the Snapshot, the Pipeline and the CV stay on screen and true; the
page-wide route error is kept for the read the page cannot do without. A write refused inside a
widget is shown against the control that caused it, in the server's words, and changes nothing.
_Avoid_: Sub-page, partial, fragment.

**Tracked links tab**:
The Job's third tab, where a Recruiter mints a named link for a channel, copies its address,
renames it, turns it off, and reads what each one brought. Minting hands the address straight back
to copy, because a link nobody can share is worth nothing. A link that is off keeps its row and its
count: turning it off ends the traffic, not the history — and so a rename leaves both the address
and the views alone. The comparison is a bar chart of views per link on the teal chart ramp, loaded
in a chunk of its own so the charting library only travels for a Recruiter who opens this tab. The
address is built on the Candidate Portal's origin, since that is the portal that counts the view.
_Avoid_: Campaigns tab, UTM builder, analytics tab.

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
