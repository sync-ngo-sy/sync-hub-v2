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

**Tracked-link landing**:
The public page a Tracked link opens. It counts the view against the link's name and
shows the Job — the visitor sees no tracking UI at all.
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

**Wrong-portal screen**:
The full-page notice shown when a signed-in Profile of the other account type opens this
portal, naming the portal they should be in.
_Avoid_: 403 page, forbidden page.
