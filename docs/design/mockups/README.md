# Frontend visual contract

Four static pages that define how the portals look. They were approved by the founder
and are the reference every frontend ticket builds against — read them before styling
anything.

| File | What it fixes |
| ---------------------------------------------- | ------------------------------------- |
| `recruiter-dashboard.html` / `-dark.html` | The Recruiter Portal shell (sidebar, header), stat cards, the applications table with its status chips, the tracked-links chart. Every other recruiter page inherits this register. |
| `candidate-landing.html` / `-dark.html` | The Candidate Portal's public voice: type-led hero, jobs as a hairline text index, three-step strip. Every other candidate page inherits this register. |

## Viewing

They are self-contained (no scripts, no external requests), but the font loads over
HTTP, so serve rather than open from disk:

```sh
python3 -m http.server 8000 --directory docs/design/mockups
```

## What is authoritative

- **Token values** — the design document
  (`docs/superpowers/specs/2026-07-29-frontend-design.md`, §8) is the source of truth,
  and these pages agree with it. Once `@sync/ui` carries the real tokens, the package
  becomes the source of truth and these pages become history.
- **Layout, spacing, and component register** — these pages are the source of truth.
- **Status chips** — teal tints for positive states (deepening toward hired); gray for
  everything else, *including disqualified and rejected*, which carry a circle-x icon;
  the alert icon marks review-required. There are no red status chips: red is reserved
  for irreversible action buttons. The dashboard pages show this correctly.

## What these are not

Not React, not a component library, and not a spec — they are hand-written HTML whose
markup nobody should copy. Rebuild the same look with the real design system.

Rejected directions and the earlier chip-scheme study are deliberately not committed:
the study predates the final "no red chips" decision and would mislead.
