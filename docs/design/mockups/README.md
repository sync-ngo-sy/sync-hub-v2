# Frontend visual contract

Static pages that define how the portals look. They were approved by the founder and
are the reference every frontend ticket builds against — read them before styling
anything.

> **Colour and size were revised in the Vellum refresh.** `vellum-dashboard.html` and
> [`../vellum.md`](../vellum.md) now carry the authoritative palette, type sizes and
> status treatment. The four original pages below are still authoritative for
> **layout and component register**, but their *colours and sizes are superseded* —
> do not copy teal `#1B7F77`, the near-white canvas, 32px controls, or the filled
> status pills from them.

| File | What it fixes |
| ---------------------------------------------- | ------------------------------------- |
| `vellum-dashboard.html` | **Current.** Palette, surfaces, type ramp, control sizing, and the status-mark treatment, in light and dark. Aesthetics only — its layout is borrowed from the page below purely as something to render colour on. |
| `recruiter-dashboard.html` / `-dark.html` | The Recruiter Portal shell (sidebar, header), stat cards, the applications table with its status chips, the tracked-links chart. Every other recruiter page inherits this register. |
| `candidate-landing.html` / `-dark.html` | The Candidate Portal's public voice: type-led hero, jobs as a hairline text index, three-step strip. Every other candidate page inherits this register. |

## Viewing

They are self-contained (no scripts, no external requests), but the font loads over
HTTP, so serve rather than open from disk:

```sh
python3 -m http.server 8000 --directory docs/design/mockups
```

## What is authoritative

- **Token values, type sizes, control sizes** — [`../vellum-tokens.css`](../vellum-tokens.css),
  explained by [`../vellum.md`](../vellum.md). This replaces §8 of
  `docs/superpowers/specs/2026-07-29-frontend-design.md`. Once `@sync/ui` carries the
  real tokens, the package becomes the source of truth and these pages become history.
- **Layout and component register** — the four original pages remain the source of truth.
- **Status** — no longer a filled chip. A status is an 8px square mark plus a plain
  label: a hollow ring for new, a four-step green ramp gaining chroma toward hired, one
  amber for "needs review", and a circle-x in slate for rejected and withdrawn. Red is
  still reserved for irreversible action buttons — there are no red status marks. See
  `vellum.md` §4; the older pages still show the superseded filled-pill scheme.

## What these are not

Not React, not a component library, and not a spec — they are hand-written HTML whose
markup nobody should copy. Rebuild the same look with the real design system.

Rejected directions and the earlier chip-scheme study are deliberately not committed:
the study predates the final "no red chips" decision and would mislead.
