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
problem document on screen.
_Avoid_: Invalid token error, 400 page.

**Wrong-portal screen**:
The full-page notice shown when a signed-in Profile of the other account type opens this
portal, naming the portal they should be in.
_Avoid_: 403 page, forbidden page.
