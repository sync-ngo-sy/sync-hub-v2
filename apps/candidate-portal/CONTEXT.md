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

**Wrong-portal screen**:
The full-page notice shown when a signed-in Profile of the other account type opens this
portal, naming the portal they should be in.
_Avoid_: 403 page, forbidden page.
