# Candidate Portal — Idea 1: The Verified Instrument

**Throwaway. Static HTML, no build, no framework, not wired to anything.** Nothing here is
imported by the app, and none of this code should be promoted as-is — it is a drawing of the
design, not an implementation of it.

## Run it

```bash
cd prototype/candidate-portal-idea-1
python3 -m http.server 4321
```

Then open **<http://127.0.0.1:4321/>** — that is the viewport shell: `←` `→` switch pages,
and the width buttons render at 1440 / 1280 / 834 / 390 so the responsive behaviour can be
judged without resizing the window.

Individual pages open directly too, and `?theme=dark` forces the dark palette:

| Page | File |
| --- | --- |
| Jobs list, search, filters | `register.html` |
| One job, with apply | `role.html` |
| Applications and stages | `record.html` |
| Profile, card, form fields | `profile.html` |

## The design

**Direction: security printing.** The portal reads as an instrument of verification, because the
product's claim is that its employers are real and its status is true. It deliberately refuses
both the job-board card grid and its opposite, the monochrome SaaS dashboard.

- **Two inks, no grey ramp.** `#0B1F1C` engraving and `#0E8074` tint, plus `#A32B22` for the one
  negative state. Secondary text is tinted from the ink hue, never grey.
- **Light is the printed document; dark is the plate it was struck from.** Light mode wears the
  logo's dark teal, dark mode its light teal, so both halves of the mark are load-bearing.
- **`guilloche.js` is the signature mechanism.** Each employer's seal is real rose-engine
  geometry — concentric sinusoidally-modulated rings, phase-shifted so the lobes weave — seeded
  from the employer's id. No two employers print the same rosette. It is generated, not an image.
- **Inputs are a certificate's ruled fill-in line**, never a boxed field. The underline is also
  the row separator; drawing both is the bug this design already made once.
- **Type**: Public Sans (the face of official public records) with IBM Plex Mono for data.
  Both self-hosted in `fonts/`.

`plate.css` is the draft of what becomes the portal's **own** `globals.css` — the candidate
portal owns its token values, while `@sync/ui` keeps only the token names its primitives read.

Each page carries its direction contract as an HTML comment at the top of `<body>`. That is the
record the design is audited against; keep it in step with the build.

## Decided

Palette and world · top-bar navigation · light and dark · plain English throughout (no
"lodge", "submit an application", "rescind") · single-select dropdown filters, because the API
filters on equality · no invented candidate, job or employer ID numbers · three candidate-facing
stages only, with the tenant's other five never shown · redundant page headings removed, since
the nav already names the page.

## Open

- "Open roles" vs "Jobs" — the headline and the nav still disagree.
- No landing page or signed-out surfaces yet.
- `Links` (LinkedIn, GitHub, portfolio) still have no database schema.
- Finish review against the direction contracts, and `DESIGN.md`, both still outstanding.
