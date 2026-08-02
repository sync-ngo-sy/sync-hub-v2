# Candidate Portal

The candidate-facing web app: browsing and applying to Jobs, managing CVs and the
professional profile, and following Applications. Domain vocabulary (Candidate,
Application, CV, Current CV, Job…) is inherited from the
[Database context](../../supabase/CONTEXT.md) and never redefined here.

## Language

**Landing page**:
The public page at the portal's root that introduces the platform to visitors. The only
surface where animation is allowed.
_Avoid_: Home page, intro page, splash.

**Browse**:
The public list of published Jobs at `/jobs`, newest first, extended a page at a time by
Load more. The API's order is fixed and its pages are cursor-keyed, so there are no page
numbers, no totals and no sorting — only "the newest page, then the next one".
_Avoid_: Search (nothing is being searched yet), job board, listings, feed.

**Job detail**:
The public page for one Job at `/jobs/:jobId` — the description, what the role asks for,
the questions an applicant will meet, and the way into applying. Reading it counts a view,
which is why nothing in the portal opens it speculatively on hover.
_Avoid_: Job page, posting, vacancy, advert.

**Tracked-link landing**:
The public page a Tracked link opens. It counts the view against the link's name and
shows the Job — the visitor sees no tracking UI at all. It is Job detail in everything a
visitor can see, at `/l/:token`: resolving the token is what counts the view, and the
address stays the link's so signing in to apply comes back to it and keeps its
attribution.
_Avoid_: Campaign page, referral page.

**My Applications**:
The signed-in Candidate's home: their Applications, newest first.
_Avoid_: Dashboard (reserved for the Recruiter Portal's home).

**Account area**:
Everything behind the sign-in guard — My Applications, CVs, the profile editor,
Notifications, Account settings. Routes live under the `_account` layout, whose guard is
the single place a Profile is checked before any of its loaders run. Browsing is
deliberately outside it: a Job is public, and the `_browse` layout renders the same
chrome with or without a session.
_Avoid_: Workspace (that is the Recruiter Portal's), dashboard area, my account.

**Profile editor**:
The one page the whole professional profile is edited on, and saved from, in a single action:
identity, Experience, Education, Skills, Other skills, Languages and Projects together. A save
replaces the profile whole, so a section left empty is an emptied section — which is why leaving
with unsaved changes asks first rather than losing them quietly.
_Avoid_: Profile settings, my details, CV builder (a CV is a file the Candidate uploads).

**Other skills**:
The skills a Candidate claims that the platform has no Canonical name for — `unmapped_skills` on
the wire. Recruiters read them; Screening never does, which is why the editor keeps them in a
section of their own rather than mixed in with Skills. Now that Skills can only be picked from
the taxonomy, this is the only route for anything the taxonomy lacks, so it is a peer of Skills
rather than a footnote to it.
_Avoid_: Unmapped skills (the wire's word, not the reader's), custom skills, free-text skills.

**Reference data**:
The platform's fixed lists — Canonical skills with their categories, and languages with their
names and codes — read from endpoints of their own and held for the session. Every field the API
constrains is a picker over one of these rather than a text box, so a profile the API would
refuse cannot be typed. Each list is small enough to fetch whole and filter in the browser;
nothing is searched server-side, and a picker shows the language's name while the profile stores
its code.
_Avoid_: Lookups, master data, enums (an enum reaches the portals through the generated client;
these are rows).

**Notifications**:
Everything the platform has told the signed-in Candidate, newest first: a CV it could not read, an
Application that moved. Two surfaces over one list — the Bell's dropdown for the newest few, and the
page at `/notifications` for all of them, a cursor at a time. Candidate-only in v1, because both
payload types are candidate-facing and a recruiter bell would be permanently empty.
_Avoid_: Alerts, activity feed, inbox, messages (a Message is a Tenant writing to an applicant).

**Bell**:
The header's way of saying something moved: the icon, and the count of Unread notifications on it.
The count is polled every minute and refetched whenever the window comes back, because coming back
is the moment a stale number gets believed. Its dropdown is a glance, and the way to the page.
_Avoid_: Notification icon, badge (the badge is the number on the Bell, not the Bell), toast.

**Unread**:
A notification nobody has opened yet. Opening one is what marks it read — the only affordance there
is, since the API cannot mark a whole list read atomically. Read ones stay in the list, quieter.
_Avoid_: New, unseen, dismissed (nothing here is ever dismissed).

**Check-your-email screen**:
Where a flow that finishes in the inbox stops: after sign-up, and after asking for a
password reset. Both legs render the same screen with their own sentence; sign-up gets a
route of its own (`/check-email`) because it is a destination, while the reset leg is
where its form ends. It names the address the email went to, and — on the reset leg —
never reveals whether that address has an account.
_Avoid_: Verification page, confirmation page, "we sent you an email" page.

**Confirmation link**:
The link in the sign-up email. Redeeming its `token_hash` at `/auth/confirm` activates the
account and lands the Candidate signed in on My Applications. Each one works once.
_Avoid_: Activation link, verification link, magic link.

**Password reset**:
Two legs, both public. The request leg emails a link and always answers the same way. The
confirm leg (`/auth/reset-password`) sets the password and ends *every* session, so it
finishes at sign-in rather than signed in — the API redeems the token, it does not hand
back a session.
_Avoid_: Forgot password (that is only the request leg's route), password recovery.

**Dead link**:
A `token_hash` that is spent, expired or malformed. Both token routes answer with the same
screen — what happened, and the one action that gets the reader moving again — never a
problem document on screen. A Tracked link that no longer resolves is the same idea a
different way: a closed Job and a switched-off link are one dead end, and both answer with
Browse as the way out.
_Avoid_: Invalid token error, 400 page.

**Wrong-portal screen**:
The full-page notice shown when a signed-in Profile of the other account type opens this
portal, naming the portal they should be in.
_Avoid_: 403 page, forbidden page.
