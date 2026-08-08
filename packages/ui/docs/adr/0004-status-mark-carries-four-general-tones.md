# 4. The Status Mark carries four general tones beside the eight application ones

Date: 2026-08-08

## Status

Accepted. Amends ADR-0003.

## Context

ADR-0003 closed with "No status exists in the design system that does not exist
in the database", written when status meant the filled chip and the chip was
imagined as an application-only component. It never was. The chip rendered a
Job's draft/published/closed/archived, a CV's parse state, a Tracked link's
live/expired/off, a colleague's access, a Tenant's suspension, and the four
screening verdicts — sixteen states with no row in `application_status`.

Issue #204 then asked for two things at once: "A Status Mark molecule renders
all eight application statuses per the vellum spec" and "Every former chip call
site renders the Status Mark; the chip component and chip tokens no longer
exist". Taken with ADR-0003's closing sentence, those three lines cannot all
hold. Something had to give.

Alternatives considered: leaving the sixteen non-application states on filled
pills (forbidden outright — "a filled chip appearing anywhere after this lands
is a bug, not a transition"); minting a `--status-draft`, `--status-live`,
`--status-ready` and so on (exactly the vocabulary sprawl ADR-0003 exists to
prevent, and each one needs two-theme AA measurement); or letting the four
verdicts and twelve other states borrow a `--status-*` token whose meaning is
an application's position in the pipeline (a Published job painted
`--status-hired` is a lie in the stylesheet).

## Decision

The Status Mark's tone vocabulary is two families.

- **Eight application tones** — `new`, `reviewing`, `shortlisted`, `interview`,
  `offer`, `hired`, `rejected`, `withdrawn` — named for the `application_status`
  values and painted by the matching `--status-*` token. This half of ADR-0003
  is unchanged and now holds by type: `ApplicationStatusTone` is what both
  portals' pipeline maps are keyed to.
- **Four general tones** — `waiting`, `active`, `attention`, `ended` — for every
  other thing with a state. They say their state by mark shape and take
  `--muted-foreground` or `--accent-foreground`. They take no `--status-*`
  token, mint none of their own, and add no hue.

ADR-0003's closing sentence is narrowed to what it was protecting: no
`--status-*` **token** exists that is not an `application_status` value.

The circle-x is the mark of a state that has ended, not of a rejection. Rejected
and Withdrawn already share it while meaning opposite things — one is the
Tenant's act, one the candidate's — so a closed Job, an expired link and an
unreadable CV wear it honestly.

## Consequences

- The general tones are deliberately indistinguishable from application tones of
  the same shape: a Qualified verdict is the same filled green as an Offer, a
  Pending one the same hollow ring as New. Vellum §4 makes the label the carrier
  of meaning and the mark a scanning aid, so this is the design working, not a
  collision. It only holds while every mark keeps its label.
- `--accent-foreground` and `--muted-foreground` now paint an 8px mark as well
  as the text jobs vellum §2 and §3 list for them. Their listed jobs are
  extended, not contested — no second token competes for a mark.
- If a general tone ever needs a colour of its own, it gets a `--mark-*` token
  with its own contrast measurement. It never gets a `--status-*` one.
- The status vocabulary is still exactly as long as the enum, which is what
  ADR-0003 set out to guarantee.
