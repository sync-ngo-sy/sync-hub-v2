# Issue 59 Account Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give signed-in candidates an account settings page where they can review account information and permanently delete their account only after confirming with their current password, ending signed out on a dedicated farewell screen.

**Architecture:** Keep the guarded `/settings` route thin and compose a candidate-owned settings feature. The feature calls the generated `deleteMyAccount` operation through the shared API client, clears the entire query cache after success, and navigates to a public `/account-deleted` terminal route so deleted identity data cannot remain in signed-in chrome.

**Tech Stack:** React 19, TypeScript, TanStack Router, TanStack Query via `@sync/api-client`, `@sync/ui`, Vitest, Testing Library, MSW/openapi-msw.

## Global Constraints

- Use the generated `POST /v1/candidates/me/deletion` operation; do not write raw HTTP or handwritten wire types.
- Explain that the live profile and CVs are removed while information already sent with Applications remains available to those employers.
- Require the current password before enabling the irreversible action.
- Clear cached account data before navigating to the signed-out farewell route.
- Keep API rejection feedback inside the deletion dialog.
- Keep frontend comments scarce and do not edit `README.md`.

---

### Task 1: Account information and the explicit deletion gate

**Files:**
- Create: `apps/candidate-portal/src/features/settings/components/account-settings-page.tsx`
- Create: `apps/candidate-portal/src/features/settings/components/delete-account-dialog.tsx`
- Create: `apps/candidate-portal/src/features/settings/hooks/use-delete-account.ts`
- Create: `apps/candidate-portal/src/features/settings/testing/handlers.ts`
- Modify: `apps/candidate-portal/src/routes/_account/settings.tsx`
- Create: `apps/candidate-portal/src/routes/_account/settings.test.tsx`

**Interfaces:**
- Consumes: the guarded route context `profile`, `api.useMutation('post', '/v1/candidates/me/deletion')`, `QueryClient.clear()`, and TanStack Router navigation.
- Produces: `AccountSettingsPage({ profile })`, `DeleteAccountDialog({ open, onOpenChange })`, `useDeleteAccount()`, and typed deletion MSW handlers.

- [ ] **Step 1: Write failing route tests for account information and the gate**

Render `/settings` as `CANDIDATE` and assert the page names the candidate and email address, renders a separate `Danger zone` heading, and honestly states that submitted Application information remains available to employers. Open deletion and prove the irreversible action is disabled while the password is empty and no request was sent:

```ts
expect(screen.getByRole('button', { name: 'Delete account permanently' })).toBeDisabled();
expect(deleted).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @sync/candidate-portal test src/routes/_account/settings.test.tsx`

Expected: FAIL because the route still renders `PlaceholderPage` and has no deletion gate.

- [ ] **Step 3: Add typed deletion handlers and the mutation hook**

Add a success handler that captures the generated request body and answers `204`, plus a `401` handler for a wrong password. Implement `useDeleteAccount()` so success clears the query client before replacing the current location with `/account-deleted`:

```ts
return api.useMutation('post', '/v1/candidates/me/deletion', {
  onSuccess: async () => {
    queryClient.clear();
    await navigate({ to: '/account-deleted', replace: true });
  },
});
```

- [ ] **Step 4: Implement the page and password-confirmation dialog**

Render a `PageHeader`, an account information card containing `profile.full_name` and `profile.email`, and a visually separated danger section. The first destructive button opens a modal. The modal explains permanence and retained Application records, labels a password input `Current password`, and disables `Delete account permanently` while the value is blank or the request is pending. Submit exactly:

```ts
deleteAccount.mutate({ body: { password } });
```

Show a wrong-password or fault detail inside the dialog and leave it open for correction. Once the
request starts, disable the password field, cancel action, and destructive action until it settles.

- [ ] **Step 5: Run focused tests and typecheck until GREEN**

Run:

```bash
pnpm --filter @sync/candidate-portal test src/routes/_account/settings.test.tsx
pnpm --filter @sync/candidate-portal typecheck
```

Expected: all settings gate tests PASS and TypeScript exits 0.

### Task 2: Signed-out farewell state and completed deletion flow

**Files:**
- Create: `apps/candidate-portal/src/features/settings/components/account-deleted-screen.tsx`
- Create: `apps/candidate-portal/src/routes/account-deleted.tsx`
- Modify: `apps/candidate-portal/src/routes/_account/settings.test.tsx`
- Modify: `apps/candidate-portal/src/routeTree.gen.ts` (generated by the TanStack Router plugin)

**Interfaces:**
- Consumes: `/account-deleted` navigation from `useDeleteAccount()` and the shared `CenteredScreen` shell component.
- Produces: a public, actionless farewell route headed `Your account has been deleted`.

- [ ] **Step 1: Add a failing deletion-flow test**

Open the deletion dialog, enter the current password, submit, and assert the captured request, public route, empty cache, farewell heading, and absence of signed-in account chrome:

```ts
expect(deleted).toHaveBeenCalledWith({ password: 'correct-horse-battery' });
expect(router.state.location.pathname).toBe('/account-deleted');
expect(queryClient.getQueryData(currentProfileQuery.queryKey)).toBeUndefined();
expect(screen.getByRole('heading', { name: 'Your account has been deleted' })).toBeVisible();
expect(screen.queryByRole('button', { name: `Account: ${CANDIDATE.full_name}` })).toBeNull();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @sync/candidate-portal test src/routes/_account/settings.test.tsx`

Expected: FAIL because `/account-deleted` and its farewell screen do not exist.

- [ ] **Step 3: Implement the public farewell route**

Add an actionless `CenteredScreen` with the heading `Your account has been deleted` and farewell copy that confirms the visitor is signed out. Give the route the page title `Account deleted`.

- [ ] **Step 4: Run the focused test and candidate checks until GREEN**

Run:

```bash
pnpm --filter @sync/candidate-portal test src/routes/_account/settings.test.tsx
pnpm --filter @sync/candidate-portal typecheck
pnpm --filter @sync/candidate-portal lint
```

Expected: focused tests PASS, TypeScript exits 0, and Biome reports no findings.

- [ ] **Step 5: Run repository verification and review before the final commit**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Review `git diff main...HEAD` against issue 59 and repository standards, fix every actionable finding, re-run affected checks, then commit with a plain-English message referencing `#59`.
