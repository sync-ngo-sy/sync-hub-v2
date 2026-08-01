# Issue 55 Applications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in candidate apply from Job detail, follow cursor-paged Applications newest-first, and permanently withdraw an active Application after explicit confirmation.

**Architecture:** Add a candidate-portal `applications` feature that owns generated API types, status presentation, application queries/mutations, MSW handlers, and UI. Job detail composes the apply form; the `/applications` route composes the list. All state changes await the API and invalidate the shared My Applications query; server rejections stay beside the initiating control.

**Tech Stack:** React 19, TypeScript, TanStack Router, TanStack Query via `@sync/api-client`, React Hook Form, Zod, `@sync/ui`, Vitest, Testing Library, MSW/openapi-msw.

## Global Constraints

- Use `@sync/api-client` generated operations and types; do not write raw HTTP or handwritten wire types.
- Candidate lists use cards/lists and cursor-based Load more, never a table, offsets, totals, or sorting controls.
- Keep apply and withdrawal rejections at the point of action; do not use toasts for these verdicts.
- Use relative list times with the absolute date-time in the `title` attribute.
- Do not optimistically update application state; await, invalidate, and refetch.
- New behavior is test-first at the HTTP boundary with typed MSW handlers.
- Keep frontend comments scarce.

---

### Task 1: Application domain presentation and apply flow

**Files:**
- Create: `apps/candidate-portal/src/features/applications/application.ts`
- Create: `apps/candidate-portal/src/features/applications/hooks/use-application-actions.ts`
- Create: `apps/candidate-portal/src/features/applications/schemas/application.ts`
- Create: `apps/candidate-portal/src/features/applications/components/application-form.tsx`
- Create: `apps/candidate-portal/src/features/applications/testing/handlers.ts`
- Modify: `apps/candidate-portal/src/features/jobs/components/apply-cta.tsx`
- Modify: `apps/candidate-portal/src/features/jobs/components/job-detail.tsx`
- Modify: `apps/candidate-portal/src/routes/_browse/jobs_.$jobId.test.tsx`
- Modify: `apps/candidate-portal/src/testing/fixtures.ts`

**Interfaces:**
- Consumes: `components['schemas']['PublicJobQuestion']`, `components['schemas']['NewApplication']`, `api.useMutation('post', '/v1/applications')`.
- Produces: `ApplicationForm({ jobId, questions, onApplied })`, `useSubmitApplication()`, `applicationFormSchema(questions)`, and shared `Application`/`ApplicationStatus` aliases.

- [ ] **Step 1: Write failing route tests for submitting and local rejection**

Add behavioral tests that click `Apply`, answer the required yes/no question, submit, and assert that the captured request is:

```ts
expect(submitted).toHaveBeenCalledWith({
  job_id: PUBLIC_JOB.id,
  answers: [
    { question_id: PUBLIC_JOB.questions[0].id, answer_boolean: true },
    { question_id: PUBLIC_JOB.questions[1].id, answer_text: 'Two weeks' },
  ],
});
expect(await screen.findByText('Application sent')).toBeVisible();
```

Add separate tests that assert `Submitting…` is disabled while the request is pending, a duplicate `409` detail is visible beside the form and no toast repeats it, and a required question prevents submission with an accessible field error.

- [ ] **Step 2: Run the focused route test and verify RED**

Run: `pnpm --filter @sync/candidate-portal test -- 'src/routes/_browse/jobs_.$jobId.test.tsx'`

Expected: FAIL because the current signed-in Apply button is disabled and no application request or form exists.

- [ ] **Step 3: Add typed fixtures and application MSW handlers**

Add an `APPLICATION` fixture using `components['schemas']['Application']`, plus typed helpers with these shapes:

```ts
export function acceptsApplication(
  application: Application,
  onSubmit?: (body: NewApplication) => void,
) {
  return [
    http.post('/v1/applications', async ({ request, response }) => {
      onSubmit?.((await request.json()) as NewApplication);
      return response(201).json(application);
    }),
  ];
}

export function refusesApplication(problem: ApplicationConflictProblemDetail) {
  return [
    http.post('/v1/applications', ({ response }) => response(409).json(problem)),
  ];
}

export function withholdsApplication() {
  return [
    http.post('/v1/applications', async ({ response }) => {
      await delay('infinite');
      return response(201).json({} as Application);
    }),
  ];
}
```

- [ ] **Step 4: Implement the schema, mutation, and minimal apply form**

Build a dynamic Zod schema keyed by question id. Required `yes_no` values accept only `'yes' | 'no'`; required `short_text` values require trimmed content; optional blank text is omitted. Convert valid values to the generated request body:

```ts
{
  job_id: jobId,
  answers: questions.flatMap((question) => {
    const value = values.answers[question.id];
    if (value === undefined || value === '') return [];
    return question.question_type === 'yes_no'
      ? [{ question_id: question.id, answer_boolean: value === 'yes' }]
      : [{ question_id: question.id, answer_text: value.trim() }];
  }),
}
```

`useSubmitApplication()` must invalidate the My Applications query on success. `ApplyCta` remains a sign-in link for signed-out readers; for signed-in candidates it reveals the form, shows local API detail text on rejection, and replaces the action with an inline success confirmation and a `/applications` link after success.

- [ ] **Step 5: Run the focused test and candidate typecheck until GREEN**

Run:

```bash
pnpm --filter @sync/candidate-portal test -- 'src/routes/_browse/jobs_.$jobId.test.tsx'
pnpm --filter @sync/candidate-portal typecheck
```

Expected: all Job detail tests PASS and TypeScript exits 0.

### Task 2: Cursor-paged My Applications states

**Files:**
- Modify: `apps/candidate-portal/src/features/applications/application.ts`
- Create: `apps/candidate-portal/src/features/applications/hooks/use-my-applications.ts`
- Create: `apps/candidate-portal/src/features/applications/components/application-card.tsx`
- Create: `apps/candidate-portal/src/features/applications/components/applications-page.tsx`
- Modify: `apps/candidate-portal/src/features/applications/testing/handlers.ts`
- Modify: `apps/candidate-portal/src/routes/_account/applications.tsx`
- Create: `apps/candidate-portal/src/routes/_account/applications.test.tsx`
- Modify: `apps/candidate-portal/src/testing/fixtures.ts`

**Interfaces:**
- Consumes: `api.useInfiniteQuery('get', '/v1/applications')`, `StatusChip`, `relativeTime`, `absoluteDateTime`, `EmptyState`, `ListSkeleton`, `ErrorCard`.
- Produces: `MY_APPLICATIONS_PAGE_SIZE`, `myApplicationsQuery`, `useMyApplications()`, `applicationState(status)`, `ApplicationsPage`, and `ApplicationCard`.

- [ ] **Step 1: Write failing list-state route tests**

Cover the issue’s observable states:

```ts
expect(applicationTitles()).toEqual([
  NEWEST_APPLICATION.job.title,
  OLDER_APPLICATION.job.title,
]);
expect(within(cardFor(NEWEST_APPLICATION)).getByText('Submitted')).toBeVisible();
expect(within(cardFor(OLDER_APPLICATION)).getByText('Interview')).toBeVisible();
expect(within(cardFor(NEWEST_APPLICATION)).getByText('2 hours ago')).toHaveAttribute(
  'title',
  absoluteDateTime(NEWEST_APPLICATION.applied_at),
);
```

Add separate tests for a layout-matching loading state, a Retry card on a failed first page, an empty state linking to `/jobs`, and Load more appending the next cursor page without replacing the first.

- [ ] **Step 2: Run the applications route test and verify RED**

Run: `pnpm --filter @sync/candidate-portal test -- src/routes/_account/applications.test.tsx`

Expected: FAIL because `/applications` still renders `PlaceholderPage`.

- [ ] **Step 3: Add paged/failure/pending typed handlers and list fixtures**

Implement handlers equivalent to the existing Jobs paging helpers:

```ts
export function pagesApplications(pages: Application[][]) {
  return [http.get('/v1/applications', ({ response, query }) => {
    const cursor = query.get('cursor');
    const index = cursor === null ? 0 : Number(cursor);
    return response(200).json({
      items: pages[index] ?? [],
      next_cursor: index + 1 < pages.length ? String(index + 1) : null,
    });
  })];
}
```

- [ ] **Step 4: Implement status mapping, infinite query, and page states**

Map all generated statuses exhaustively:

```ts
new: ['Submitted', 'neutral'],
reviewing: ['Reviewing', 'neutral'],
shortlisted: ['Shortlisted', 'shortlisted'],
interview: ['Interview', 'interview'],
offer: ['Offer', 'offer'],
hired: ['Hired', 'hired'],
rejected: ['Not selected', 'negative'],
withdrawn: ['Withdrawn', 'neutral'],
```

Flatten pages in `select`, render list rows newest-first exactly as returned, and expose Load more only while `hasNextPage` is true. The empty action is a primary `Browse jobs` link to `/jobs`.

- [ ] **Step 5: Run focused tests and typecheck until GREEN**

Run:

```bash
pnpm --filter @sync/candidate-portal test -- src/routes/_account/applications.test.tsx
pnpm --filter @sync/candidate-portal typecheck
```

Expected: all Applications list tests PASS and TypeScript exits 0.

### Task 3: Permanent withdrawal

**Files:**
- Modify: `apps/candidate-portal/src/features/applications/application.ts`
- Modify: `apps/candidate-portal/src/features/applications/hooks/use-application-actions.ts`
- Modify: `apps/candidate-portal/src/features/applications/components/application-card.tsx`
- Create: `apps/candidate-portal/src/features/applications/components/withdraw-application-dialog.tsx`
- Modify: `apps/candidate-portal/src/features/applications/testing/handlers.ts`
- Modify: `apps/candidate-portal/src/routes/_account/applications.test.tsx`

**Interfaces:**
- Consumes: `api.useMutation('post', '/v1/applications/{application_id}/withdraw')`, shared My Applications query key, Base UI AlertDialog.
- Produces: `useWithdrawApplication()`, `canWithdraw(status)`, and `WithdrawApplicationDialog({ application, open, onOpenChange })`.

- [ ] **Step 1: Write failing withdrawal behavior tests**

Assert that opening Withdraw names the Job and displays both irreversible consequences, cancellation sends no request, confirmation shows `Withdrawing…`, and a successful response is followed by a refetched `Withdrawn` chip. Add a race rejection test asserting the API detail remains in the open dialog.

```ts
expect(within(dialog).getByText(APPLICATION.job.title)).toBeVisible();
expect(within(dialog).getByText(/cannot be undone/i)).toBeVisible();
expect(within(dialog).getByText(/cannot apply to this job again/i)).toBeVisible();
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `pnpm --filter @sync/candidate-portal test -- src/routes/_account/applications.test.tsx`

Expected: FAIL because application rows have no Withdraw action.

- [ ] **Step 3: Add typed withdrawal handlers**

Add success, delayed, and rejection helpers for `POST /v1/applications/{application_id}/withdraw`, capturing `params.application_id` so the test proves the correct Application was targeted.

- [ ] **Step 4: Implement guarded withdrawal and refetch**

Expose Withdraw only for `new`, `reviewing`, `shortlisted`, `interview`, and `offer`. The alert dialog action is destructive, disables both dismissal actions while pending, keeps a server rejection beside the action, closes only after success, and invalidates/refetches My Applications before the row is considered updated.

- [ ] **Step 5: Run focused tests and typecheck until GREEN**

Run:

```bash
pnpm --filter @sync/candidate-portal test -- src/routes/_account/applications.test.tsx
pnpm --filter @sync/candidate-portal typecheck
```

Expected: all Applications tests PASS and TypeScript exits 0.

### Task 4: Full verification and review

**Files:**
- Review all files changed since `main`.

**Interfaces:**
- Consumes: repository scripts and issue 55 acceptance criteria.
- Produces: a clean, committed branch whose diff satisfies both repository standards and the ticket.

- [ ] **Step 1: Run candidate lint, typecheck, build, and tests**

Run:

```bash
pnpm --filter @sync/candidate-portal lint
pnpm --filter @sync/candidate-portal typecheck
pnpm --filter @sync/candidate-portal build
pnpm --filter @sync/candidate-portal test
```

Expected: every command exits 0 with no unexpected warnings.

- [ ] **Step 2: Run the monorepo full test suite once**

Run: `pnpm test`

Expected: every workspace test task exits 0.

- [ ] **Step 3: Review standards and spec in parallel using `/code-review`**

Review `main...HEAD` against repository guidance and issue 55. Fix every confirmed finding, then rerun the smallest affected test plus candidate typecheck.

- [ ] **Step 4: Re-run final verification after review fixes**

Run:

```bash
pnpm --filter @sync/candidate-portal lint
pnpm --filter @sync/candidate-portal typecheck
pnpm --filter @sync/candidate-portal test
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the complete issue implementation**

```bash
git add -- docs/superpowers/plans/2026-08-01-issue-55-applications.md apps/candidate-portal
git commit -m "Implement candidate applications flow (#55)"
```
