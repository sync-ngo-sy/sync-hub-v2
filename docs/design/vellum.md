# Vellum — the visual refresh

**Scope: aesthetics only.** Colour, size, weight, spacing, radius, and the shape of a
status mark. Nothing here changes layout, component structure, routing, or where
anything sits on a page. The portals are already built and working; this is a re-skin
applied to what exists.

Supersedes the token values in `docs/superpowers/specs/2026-07-29-frontend-design.md` §8
("Design system — Ledger"). That document remains correct on everything else. It is
currently deleted from the working tree but still tracked in git; restore it with
`git checkout -- docs/superpowers/` if you need the original rationale.

This file plus [`vellum-tokens.css`](./vellum-tokens.css) are self-contained — you do not
need that spec to apply the refresh.

| | |
| ------------------ | ------------------------------------------------------------ |
| Token values | [`vellum-tokens.css`](./vellum-tokens.css) — drop into `packages/ui/src/styles/globals.css` |
| Rendered reference | [`mockups/vellum-dashboard.html`](./mockups/vellum-dashboard.html) |
| Typeface | Geist, unchanged. One family, no pairing. |

---

## 1. What changed, in one line each

1. **Light theme is one warm ramp with no white in it.** Canvas → card → input, each
   lighter than the last, all the same temperature.
2. **A dark green panel.** The rail is `--deep` in light theme, not an off-white.
3. **A four-step teal**, each step with exactly one job.
4. **A three-step text ramp.** `--muted-foreground` was doing three jobs and now does one.
5. **Status is a mark and a label**, not a filled pill.
6. **Point 22 sizing**: 32px controls → 36px, 14/13px text → 15/14px.

---

## 2. The four-step teal

Each step owns a category. Nothing should ever compete for the same element.

| Token | Light | Job |
| ----------------------- | --------- | ------------------------------------------- |
| `--deep` | `#125650` | Rail, sign-in crown. Surfaces only. |
| `--primary` | `#0F6459` | Solid actions, focus ring. Sits one step **above** the panel so the rail recedes and the action advances. |
| `--accent-foreground` | `#0F6E63` | Links, tinted text, the `+18` deltas on stat cards. |
| `--accent` | `#E5EBE5` | Tint surfaces: stat-card icon tiles, avatar fallback. |

`#0F6E63` is the **floor** for `--accent-foreground`: 5.7:1 on `--card`, 5.1:1 on
`--background`. One step lighter (`#12867A`) drops to 4.1:1 and fails AA for anything
under 18px, and this token paints 13–14px text. If something using it still reads too
dark, the fix is larger text or a fill — not a lighter green.

---

## 3. The three-step text ramp

This is the rule that matters most, because the old system had one grey doing three
jobs, which meant nothing read as secondary.

| Token | Use it for |
| ----------------------- | ------------------------------------------------------- |
| `--foreground` | What a recruiter came to read: names, figures, table cell values, headings, years of experience. |
| `--secondary-foreground` | Structure and attribution: table headers, the role under a name, field labels, section headings. Present, not competing. |
| `--muted-foreground` | Genuinely disposable: placeholders, relative timestamps, `since Monday` deltas, empty-state copy, keyboard hints. If it vanished, nobody would file a bug. |

**Three specific corrections to make while applying this**, all previously on
`--muted-foreground`:

- Table headers → `--secondary-foreground`
- The role/job title under a candidate name → `--secondary-foreground`, at `--text-meta`
- Years of experience → `--foreground` (it is a value, not a caption)

---

## 4. Status marks

Status is **a mark and a label**. No pill, no fill, no border, no rounded container.

```text
  ○ New          hollow ring     background: transparent; box-shadow: inset 0 0 0 2px var(--status-new)
  ● In review    filled          the only amber in the system
  ● Shortlisted  filled
  ● Interview    filled
  ● Offer        filled
  ● Hired        filled          the greenest mark on the row
  ✕ Rejected     circle-x icon   no dot; icon takes var(--status-rejected)
  ✕ Withdrawn    circle-x icon   no dot; icon takes var(--status-withdrawn)
```

Mark: **8px square, 2px radius**, `flex: 0 0 8px`.
Label: **14px, weight 540, `--foreground`**. Gap between them: **8px**.
Icon (rejected / withdrawn): **13px**, coloured by the status token.

Three rules behind this:

- **The ramp gains chroma toward hired, not darkness.** Chroma runs 38 → 75 → 114 → 141
  across shortlisted → interview → offer → hired. An earlier attempt made "greener" mean
  "darker" and hired came out at `#04443C`, which reads as black — the opposite of the
  intent.
- **New is hollow, not a colour.** Five distinguishable steps of one hue do not exist at
  8px; adjacent pairs measured 1.02–1.10:1. New leaving the ramp is also truer: it is the
  absence of progress, not a stage of it. Shape does the work colour could not.
- **Colour is never the only signal.** The label always carries the meaning; the mark is a
  scanning aid. Red remains reserved for irreversible action buttons — there are still no
  red status marks.

Total vocabulary: **one green ramp + amber + slate.** Do not add a fourth hue.

---

## 5. Sizes and weights

Tokenised — in [`vellum-tokens.css`](./vellum-tokens.css):

| Token | From | To |
| ------------------ | ----------- | ----------- |
| `--text-dense` | `0.875rem` | `0.9375rem` |
| `--text-meta` | `0.8125rem` | `0.875rem` |
| `--text-title` | `0.9375rem` | `1rem` |
| `--text-figure` | `1.8125rem` | `2rem` |
| `--text-figure--font-weight` | `560` | `470` |
| `--radius` | `0.5rem` | `0.625rem` |

Not tokenised — apply directly:

| Element | Value |
| ------------------------ | ------------------------------------------------- |
| Input / button height | **36px** (`h-8` → `h-9`) — this is the core of point 22 |
| Input horizontal padding | **12px** (`px-2.5` → `px-3`) |
| Input background | `--input-background` (currently `bg-transparent`) |
| Table cell padding | **14px 20px** |
| Table header | 11.5px, uppercase, `letter-spacing: .09em`, weight **640**, `--secondary-foreground`, padding `13px 20px 11px`, no background band |
| Sidebar nav item | **15px**, weight **520**, icon **18px**, padding `10px` |
| Sidebar section label | 11.5px, uppercase, `letter-spacing: .09em`, weight 600, `--sidebar-label` |
| Stat card padding | **16px 18px** |
| Avatar (table row) | **34px** |

Stat figures are **big and light** (32px / 470), not big and heavy. If they read as too
strong, reduce weight — do not lighten the colour, which would add a fourth grey outside
the ramp in §3.

---

## 6. Two things that need a decision, not just a token swap

**a. `components/ui/*` has to be touched.** `packages/ui/CONTEXT.md` says Primitives are
shadcn CLI output, kept as generated and never hand-edited. But point 22 is a change to
the default size of `input` and `button` (`h-8` → `h-9`, `px-2.5` → `px-3`), which lives
in exactly those files. Someone has to choose: edit them and drop the rule, wrap them, or
regenerate from a modified config. This cannot be resolved with tokens alone.

**b. `--input` is the input *border*, not its background.** The current `input.tsx` uses
`border-input` with `bg-transparent`. Giving inputs their own background — which is what
makes them the lightest surface and the only near-white thing on the page — needs the new
`--input-background` token wired into the primitive. Same decision as (a).

---

## 7. Contrast

Every pairing was measured against the surface it actually sits on. All text meets WCAG AA
(4.5:1); status marks are held to the 3:1 non-text threshold where achievable.

| Pairing | Ratio |
| ------------------------------------------ | ------- |
| `--foreground` on `--card` | 16.2:1 |
| `--secondary-foreground` on `--card` | 8.0:1 |
| `--muted-foreground` on `--background` | 4.6:1 |
| `--accent-foreground` on `--card` | 5.7:1 |
| `--accent-foreground` on `--background` | 5.1:1 |
| `--primary-foreground` on `--primary` | 6.7:1 |
| `--sidebar-foreground` on `--sidebar` | 6.9:1 |
| `--sidebar-label` on `--sidebar` | 5.2:1 |
| `--sidebar-accent-foreground` on `--sidebar` | 8.1:1 |
| Status marks on `--card` | 3.5–5.9:1 |

**One known exception:** `--status-withdrawn` measures **2.84:1** on `--card`, just under
the 3:1 non-text threshold. It is acceptable only because that state renders as a `✕` icon
beside a text label rather than as colour alone. Darken it if it ever appears without its
label.

---

## 8. Out of scope

Not addressed here, and not to be inferred from the reference page: page layout, component
placement, navigation structure, routing, the shape of any feature, and the rest of
issue #184. The reference mockup reuses the existing dashboard arrangement purely as a surface to
show colour and size on — it is **not** a layout proposal.
