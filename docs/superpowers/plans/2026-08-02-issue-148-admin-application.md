# Admin Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the third Sync portal where Platform admins can inspect platform counts and operate Tenants.

**Architecture:** Create an independent Vite application under `apps/admin-portal`. It owns its auth, shell, Platform queries, and route-level tests while consuming only the generated API client and the data-free design system. Existing portals learn the admin portal URL, and the API sends Platform-admin password resets to the new app.

**Tech Stack:** React 19, TanStack Router and Query, React Hook Form, Zod, `@sync/api-client`, `@sync/ui`, Vitest, Testing Library, MSW/openapi-msw.

## Global Constraints

- Test through rendered routes and OpenAPI-typed network handlers.
- Plan is displayed but not editable.
- Tenant suspension and restoration must state their consequences before confirmation.
- The application supports light and dark themes and uses accessible names and semantic controls.
- Operator features remain outside the Recruiter Portal bundle.
- Deployment itself remains owned by the infrastructure work identified as out of scope in parent issue #137.

---

### Task 1: Application shell and access guard

**Files:**
- Create: `apps/admin-portal/package.json`, Vite/TypeScript config, `index.html`, environment and app bootstrap files
- Create: `apps/admin-portal/src/features/auth/**`, `apps/admin-portal/src/features/shell/**`, and routes for sign-in, reset password, wrong portal, and the guarded admin shell
- Create: `apps/admin-portal/src/testing/**` and route tests

**Interfaces:**
- Consumes: `GET /v1/auth/me`, `POST /v1/auth/login`, `POST /v1/auth/logout`, password-reset endpoints
- Produces: guarded `/overview` and `/tenants` destinations available only to `platform_admin` Profiles

- [ ] Write route tests for anonymous, Platform-admin, Candidate, and Recruiter entry.
- [ ] Run the route test and verify the missing application fails.
- [ ] Add the minimal application shell and auth flows.
- [ ] Run the route test and `pnpm --filter @sync/admin-portal typecheck`.

### Task 2: Platform overview

**Files:**
- Create: `apps/admin-portal/src/features/platform/**`
- Create: `apps/admin-portal/src/routes/_admin/overview.tsx`
- Create: `apps/admin-portal/src/routes/_admin/overview.test.tsx`

**Interfaces:**
- Consumes: `GET /v1/platform/overview`
- Produces: four named stat cards for Tenants, Candidates, Jobs, and Applications

- [ ] Write the rendered-route test with a typed overview handler.
- [ ] Run it red.
- [ ] Add the overview query and screen.
- [ ] Run it green and typecheck the app.

### Task 3: Tenant operations

**Files:**
- Create: tenant types, queries, mutations, form schema/components, typed handlers, and route test under `apps/admin-portal/src/features/platform/**`
- Create: `apps/admin-portal/src/routes/_admin/tenants.tsx`

**Interfaces:**
- Consumes: `GET/POST /v1/platform/tenants`, `POST /v1/platform/tenants/{tenant_id}/invite`, `PATCH /v1/platform/tenants/{tenant_id}`
- Produces: accessible Tenant table, creation dialog, invite resend, suspension, and restoration confirmations

- [ ] Write one route-level tracer test for the list and create flow; run red, implement, run green.
- [ ] Add a tracer test for invite resend; run red, implement, run green.
- [ ] Add tracer tests for suspension and restoration consequences; run red, implement, run green.
- [ ] Typecheck and lint the app.

### Task 4: Cross-portal and backend wiring

**Files:**
- Modify: both existing wrong-portal screens and environment files/examples
- Modify: `sync_core.settings.Settings`, `AuthService`, dependency wiring, Supabase redirect allowlist, API fixtures/tests, compose environment example

**Interfaces:**
- Consumes: `SYNC_ADMIN_PORTAL_URL` and `VITE_ADMIN_PORTAL_URL`
- Produces: Platform-admin reset links and wrong-portal links that land in the admin app

- [ ] Add the API password-reset test and run it red.
- [ ] Thread the admin URL through settings and auth; run the focused API test green.
- [ ] Add portal route assertions for the new destination; run them red then green.
- [ ] Run API and frontend typechecks.

### Task 5: Repository documentation and verification

**Files:**
- Modify: `README.md`, `CONTEXT-MAP.md`, existing portal context documents, and `docs/runbook-local-dev.md`
- Create: `apps/admin-portal/CONTEXT.md`
- Create: `docs/adr/0011-platform-operations-live-in-a-third-application.md`

- [ ] Correct two-portal language and document port 5175 and local startup.
- [ ] Record the new context relationships and ADR.
- [ ] Run formatting, lint, typecheck, builds, focused tests, and the full suite (recording the authorized pooler exception if it recurs).
- [ ] Review the branch against repository standards and issue #148, then address every actionable finding.

