# Sync frontend — design

Date: 2026-07-29. Status: agreed with the founder after a full grilling session and a
visual brainstorm with rendered mockups. This document is the input to `/to-spec` and
`/to-tickets`. Domain vocabulary: [CONTEXT-MAP.md](../../../CONTEXT-MAP.md) and the
per-context `CONTEXT.md` files. Standing decisions: ADR-0007 (English only, no i18n),
ADR-0008 (generated OpenAPI client is the only API path), ADR-0009 (`@sync/ui` is
data-free, no shared features package).

## 1. Scope

Two Vite + React 19 SPAs — `apps/candidate-portal` and `apps/recruiter-portal` —
covering the entire existing backend API surface (~70 operations). The backend is
finished; nothing here is speculative. Everything the API cannot do yet lives in an
explicit fast-follow bucket (§13) and never blocks v1.

## 2. Page maps

### Candidate portal (mobile-first, flawless from 360px up)

| Page | Backed by |
| -------------------------------- | ------------------------------------- |
| Landing (public, the one animated surface) | — |
| Browse jobs, job detail | `browseJobs`, `getPublicJob` |
| Tracked-link landing `/l/:token` (silent; no tracking UI) | `getJobByTrackedLink` |
| Sign up → confirm email → log in → password reset | auth ops |
| My Applications (authed home; list, withdraw) | application ops |
| Apply flow (from job detail) | `submitApplication` |
| Profile editor | `getMyProfile`, `replaceMyProfile` |
| CVs (upload, parse progress, profile draft review, set current, cap 5) | the 7 CV ops |
| Notifications (bell + page) | 3 notification ops |
| Account settings (danger zone: delete account) | `deleteMyAccount` |

### Recruiter portal (desktop-first ≥1024px; everything still usable on a phone — responsiveness is a per-ticket acceptance criterion, not a later pass)

| Page | Backed by |
| -------------------------------- | ------------------------------------- |
| Landing (public: what the platform is, WhatsApp + mailto contact, workspace sign-up) | `signUpTenant` |
| Log in, accept invite, password reset | auth ops |
| Dashboard (authed home) | real data only, see §10 |
| Jobs list → job detail tabs: Applications, Screening criteria, Tracked links | job + link ops |
| Job create / edit / lifecycle | `createJob`, `changeJob`, `replaceJobCriteria` |
| Application detail: pipeline, AI match assessments, notes, tags, message applicant | 12 application ops |
| Candidate search + candidate view (notes, tags, save to talent pool) | search + CRM ops |
| Talent pool | 3 ops |
| Message templates CRUD | 5 ops |
| Settings: team (invite, roles), tags vocabulary, tenant | tenant + tag ops |

Wrong-portal handling: a signed-in Profile of the other `account_type` gets a
full-page notice naming the right portal — never a bare 403.

## 3. Stack

| Concern | Choice |
| -------------------------------- | ------------------------------------- |
| Routing | TanStack Router (file-based, type-safe routes and search params) |
| Server state | TanStack Query via `openapi-react-query` over the generated `openapi-fetch` client |
| Client generation | `openapi-typescript` from `services/api`'s `openapi.json` (existing `gen` script) |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Tables | TanStack Table (recruiter portal only) |
| Charts | Recharts (recruiter portal only) |
| Toasts | Sonner |
| Error boundaries | `react-error-boundary` + router `errorComponent`s |
| Styling | Tailwind v4 + shadcn (Base UI flavor) in `packages/ui` |
| Fonts | `@fontsource-variable/geist` (already wired) |
| Icons | lucide-react (labels always accompany icons) |
| Animation | `motion`, imported ONLY by the two landing features |
| Tests | Vitest + React Testing Library + MSW + `openapi-msw` (jsdom) |

Zod's three roles only: form schemas (hand-written, colocated), router search-param
validation, `import.meta.env` validation. Never for API responses (ADR-0008).

## 4. Code layout

```text
packages/ui/                      ← design system (data-free, ADR-0009)
  src/styles/globals.css          ← the one token file (§8)
  src/components/ui/              ← shadcn CLI output, NEVER hand-edited,
                                    Biome lint+format disabled for this glob only;
                                    typecheck stays ON (vendored code must compile)
  src/components/                 ← hand-written molecules: DataTable, FormField
                                    wrappers, EmptyState, StatCard, PageHeader,
                                    ChartCard, skeletons, NotificationBell/List,
                                    auth form shells
  src/hooks/                      ← UI-only hooks

apps/<portal>/src/
  routes/                         ← TanStack Router files (thin composition)
  features/<feature>/
    components/                   ← presentational, feature-specific
    hooks/                        ← containers wrapping api.useQuery/useMutation
    schemas/                      ← Zod form schemas
    testing/                      ← MSW handlers for this feature
  lib/                            ← query client, router, env, reportError
```

Promotion rule: a component moves from a feature into `@sync/ui` only when a second
consumer appears. Shared-in-both-portals features (notifications, auth forms) share
presentational components via `ui`; each app duplicates the thin data hook.

**Code splitting (binding):** route-level chunks via TanStack Router's lazy routes
(Vite plugin `autoCodeSplitting`), `React.Suspense` fallbacks rendering the skeleton
components, and heavy dependencies (`motion` on the landings, Recharts on dashboard
panels) always isolated in their own lazy chunks.

## 5. API client (`@sync/api-client`)

All cross-cutting request behavior lives in this package's middleware, invisible to
both apps: `credentials: "include"` (HttpOnly cookie sessions), the `X-Sync-Request`
CSRF header on every mutating request, 401 → `refreshSession` → retry-once (failed
refresh → hard redirect to login with `returnTo`), base URL from validated env. It
exports the `openapi-react-query` instance both apps consume. Dev uses a Vite proxy
(`/v1` → `localhost:8000`) so cookies stay same-origin; production must serve portals
same-site with the API.

## 6. Auth UX

Auth state is the `getCurrentProfile` query, nothing else. Protected routes await it
in `beforeLoad`; unauthenticated → `/login?returnTo=…`, honored after login.
Public-only routes bounce authed users home. Sign-up → "check your email" screen;
`confirmEmail` / `acceptInvite` / password-reset routes consume emailed tokens.
`confirmEmail` and `acceptInvite` land signed in; the password-reset confirm leg cannot
and does not — corrected during #53, against the API: it answers 204 with no cookies and
`AuthService.reset_password` revokes every session, so that leg finishes at sign-in with
the new password. Log out revokes all sessions, clears the query cache, returns to the
landing page.

## 7. UX conventions (binding)

1. **Loading:** page-level = layout-matching skeletons; spinners only inside pending
   buttons. Router `ensureQueryData` prefetches on navigation.
2. **Errors, three tiers:** field errors in-form (RHF `setError`); widget errors in
   `react-error-boundary` panels with inline "Couldn't load — Retry"; route errors in
   router `errorComponent` + one app-shell boundary. Never a white screen. All
   boundary `onError`s call `reportError(error, context)` — a `console.error` seam in
   v1, one-file Sentry adoption later.
3. **Sonner:** action outcomes and homeless mutation failures only. Never validation,
   never background query failures.
4. **Query defaults:** `staleTime` 30s; `retry: 1` but never on 4xx; mutations retry 0.
5. **No optimistic updates in v1.** Await → invalidate → refetch.
6. **Empty states are designed:** every list gets `EmptyState` (icon, one sentence,
   one primary action), specified per ticket.
7. **Dates/numbers:** `Intl` only; relative times in lists with absolute on hover;
   absolute on detail pages; browser timezone. No date library unless a real need
   appears (then `date-fns`).
8. **React Query Devtools** in dev builds only.
9. **A11y = WCAG 2.1 AA by convention:** primitives keep Base UI keyboard/ARIA
   behavior; every interactive element has an accessible name; visible focus ring
   from tokens; tests query by role/name.

## 8. Design system — "Ledger"

Chosen direction: **Ledger — calm enterprise** (Stripe/Mercury register). Warm
near-white canvas, white cards with hairline borders and near-zero shadows, generous
whitespace, teal spent sparingly. Light AND dark themes ship in v1 (components
reference semantic tokens only; the themes differ purely in `:root` values — proven
by the mockups). Fluid `clamp()` type for display/headings only; body fixed 14px
(dense recruiter surfaces) / 16px (candidate reading surfaces). Spacing stays
Tailwind's scale. Radius 0.5rem.

**Status colors — final scheme (founder-revised):** teal tints = positive states
(qualified, shortlisted, interview, offer, hired, published — ramp deepens toward
hired); gray tints = everything else (pending, new, reviewing, draft, withdrawn,
closed, archived, **disqualified, rejected**); **no red status chips anywhere**.
Negatives carry a small circle-x icon; "review required" carries a circle-alert icon
(color is never the only signal). `--destructive` exists solely for irreversible
action buttons and confirmations. Charts use the teal ramp + gray; `--warning`/
`--info` are defined for rare banner use, never chips.

**Destructive role, revised 2026-07-31 (during #46):** the shadcn primitives consume
`--destructive` as the red *itself* — `text-destructive`, and `bg-destructive/10` for a
wash — so the original tint-plus-text pairing rendered `#FBEAEA` text on white at
1.16:1. `--destructive` is now the red (`#9F3129` / `#F0938A`), `--destructive-muted`
carries the flat tint the values below first named, and `--destructive-foreground` is
the text on a solid red fill. The rendered result is unchanged: `bg-destructive/10`
computes to `#F5EAEA`, within a hair of the approved `#FBEAEA`, with `#9F3129` text on
it at 6.06:1.

**Approved light tokens** (from the mockups; `#1D867E` on white measures 4.41:1 — under
AA's 4.5:1 for small text — so `--accent-foreground` `#166B65` is the mandatory teal for
sub-18px text):

```css
:root {
  --background: #FAFAF9;  --foreground: #1C1917;
  --card: #FFFFFF;        --card-foreground: #1C1917;
  --popover: #FFFFFF;     --popover-foreground: #1C1917;
  --primary: #1D867E;     --primary-foreground: #FFFFFF;
  --secondary: #F5F5F4;   --secondary-foreground: #44403C;
  --muted: #F0EFED;       --muted-foreground: #78716C;
  --accent: #EAF5F3;      --accent-foreground: #166B65;
  --destructive: #9F3129; --destructive-foreground: #FFFFFF;
  --destructive-muted: #FBEAEA;
  --success: #E7F5EC;     --success-foreground: #1E6B45;
  --warning: #FCF1DC;     --warning-foreground: #8A5A0A;
  --info: #E9F1FB;        --info-foreground: #1E4E8C;
  --border: #E7E5E4;      --input: #D9D6D3;   --ring: #1D867E;
  --radius: 0.5rem;
  --chart-1: #1D867E; --chart-2: #339E95; --chart-3: #4DBFB4;
  --chart-4: #7ED1C8; --chart-5: #D6D3D1;
  --sidebar: #F6F5F3; --sidebar-foreground: #44403C; --sidebar-accent: #EAF5F3;
  /* teal pipeline ramp (extension tokens) */
  --chip-shortlisted: #DCF0EC; --chip-shortlisted-foreground: #125F59;
  --chip-interview:   #CBE9E3; --chip-interview-foreground:   #0F544F;
  --chip-offer:       #BEE3DC; --chip-offer-foreground:       #0B4A45;
  --chip-hired:       #12615B; --chip-hired-foreground:       #FFFFFF;
}
```

**Approved dark tokens:**

```css
.dark {
  --background: #131211;  --foreground: #F5F5F4;
  --card: #1C1A19;        --card-foreground: #F5F5F4;
  --popover: #1C1A19;     --popover-foreground: #F5F5F4;
  --primary: #23968D;     --primary-foreground: #FFFFFF;
  --secondary: #211E1C;   --secondary-foreground: #D6D3D1;
  --muted: rgba(255,255,255,0.06); --muted-foreground: #A29E9A;
  --accent: rgba(63,181,168,0.16); --accent-foreground: #3FB5A8;
  --destructive: #F0938A; --destructive-foreground: #131211;
  --destructive-muted: rgba(224,94,84,0.18);
  --success: rgba(74,179,126,0.16);    --success-foreground: #6FD19B;
  --warning: rgba(217,155,42,0.16);    --warning-foreground: #E8B94D;
  --info: rgba(74,130,216,0.16);       --info-foreground: #7FB0F0;
  --border: #2A2827;      --input: #332F2D;   --ring: #3FB5A8;
  --radius: 0.5rem;
  --chart-1: #2BA89D; --chart-2: #3FB5A8; --chart-3: #63C9BD;
  --chart-4: #93DAD1; --chart-5: #4A4542;
  --sidebar: #100F0D; --sidebar-foreground: #D6D3D1;
  --sidebar-accent: rgba(63,181,168,0.16);
  /* teal pipeline ramp (extension tokens) */
  --chip-shortlisted: rgba(63,181,168,0.12); --chip-shortlisted-foreground: #52C2B5;
  --chip-interview:   rgba(63,181,168,0.17); --chip-interview-foreground:   #6ED0C4;
  --chip-offer:       rgba(63,181,168,0.22); --chip-offer-foreground:       #8DDBCF;
  --chip-hired:       #4DBFB4;               --chip-hired-foreground:       #0B2C29;
}
```

**Brand:** logo mark at `apps/<project-name>/public/logo.png` (favicon + OG base); headers pair the mark
with "Sync" in Geist. Titles: `<Page> · Sync` (candidate) / `<Page> · Sync Recruiter`.

**Reference mockups** live in `docs/design/mockups/` (see its README for how to serve
them): the approved Recruiter Dashboard and Candidate Landing, each in light and dark.
Those four pages are the visual contract — they fix layout, spacing, and component
register, and every other page follows them. This document remains the source of truth
for token *values* until `@sync/ui` carries them.

## 9. Landings & motion

Candidate landing = the **Editorial** concept: type-led hero ("Syria's jobs, in one
*clear* place." — one word in teal), jobs as a hairline-ruled text index, zero
product imagery, no stacked-card montages. Recruiter landing explains the platform to
companies, with WhatsApp deep-link + `mailto:` contact (numbers/addresses from env;
no contact-form endpoint exists) and workspace sign-up.

`motion` appears only in the two landing features, lazy-loaded. Hero animation: a
typewriter/cursor text reveal (implementation — `motion` vs. CSS vs. a vendored
React Bits snippet — decided in that ticket). `prefers-reduced-motion` collapses all
of it to static. Everywhere else: shadcn's stock ~150ms CSS transitions only.

## 10. Tables, charts, dashboard

The API paginates by cursor (no totals, no offsets, fixed newest-first order, hard
server-side filters). Therefore, honestly: "Load more" via `useInfiniteQuery` (no
page numbers), **no sortable column headers in v1**, filters as Zod-validated URL
search params (segmented tabs above tables). One `DataTable` molecule serves all
recruiter lists; the candidate portal uses cards/lists, never TanStack Table. Row
actions: row click opens detail; named actions in a trailing overflow menu.

Charts (v1) are limited to data that exists: the tracked-links horizontal bar chart
(`view_count` per link) on the job's Tracked links tab. The Dashboard shows real
things only — recent applications, jobs overview, awaiting-review counts derived
from first pages — with designed slots for trend charts that fill when the
fast-follow analytics endpoints land.

## 11. Notifications

Candidate portal only in v1 (the only two payload types are candidate-facing; a
recruiter bell would be eternally empty). Bell + unread badge (poll 60s + window
focus) → dropdown → "View all" page (cursor-paged). Items render per discriminated
`type` and deep-link (`cv_parse_failed` → CVs; `application_status_changed` → the
application). Click marks read (single-item endpoint). No "mark all as read" — the
API cannot do it atomically.

## 12. Testing

MSW at the network edge — real hooks, real client, intercepted requests; handlers
typed by `openapi-msw` so schema drift fails compilation. Layers: `ui` components via
RTL (roles, keyboard); feature hooks via RTL + MSW (loading/data/error, mutation →
invalidation); Zod schemas as unit tests; per-portal route smoke tests (login, apply,
move an application through the pipeline). Tests colocated; no numeric coverage gate —
each ticket lists the behaviors its tests must cover. CI already runs
lint/typecheck/build/test for `apps/*` + `packages/*`.

## 13. Explicitly out of v1 (fast-follow bucket)

Backend-first items, never blocking the frontend critical path: tenant analytics
endpoints (views over time, counts by pipeline stage) → dashboard trend charts;
recruiter notification types → recruiter bell (component will already exist);
atomic mark-all-read; contact-form endpoint; per-job OG meta service (v1 ships
polished site-wide OG only — WhatsApp previews are generic by accepted trade-off).
Frontend deferrals: Storybook (components stay Storybook-ready by construction;
a dev-only kitchen-sink route substitutes), Sentry (the `reportError` seam ships in
v1), optimistic updates, mobile-optimized recruiter layouts beyond "everything
usable".

## 14. Phasing (for `/to-tickets`)

**Phase 0 — foundations (blocking):**

1. Tokens: this document's §8 values land in `packages/ui/src/styles/globals.css`
   (light + `.dark`), fonts, fluid heading scale.
2. shadcn setup: `components.json`, primitives batch into `components/ui/`, Biome
   override, folder split.
3. `@sync/api-client` hardening: middleware + `openapi-react-query` export
   (independent of 1–2).
4. `@sync/ui` molecules (needs 1–2).
5. Test infrastructure: Vitest config, MSW + `openapi-msw`, render helpers (needs 3).
6. Two app shells: router (lazy routes), query client, env validation, auth
   bootstrap + guards + wrong-portal screen, layout chrome, error boundaries, Sonner,
   theme toggle, kitchen-sink route (needs 3–4; the two shells parallelize).

**Then two independent tracks (one ticket per feature-page):**
candidate: landing (+typewriter) → auth flows → browse/detail/`/l/:token`/apply →
My Applications → CVs → profile editor → notifications → account settings.
recruiter: landing → auth → dashboard → jobs → job detail tabs → application detail →
candidate search + view → talent pool → templates → settings.

The first n tickets (Phase 0) are exactly the shared-package work that lets both app
tracks run in parallel afterwards.
