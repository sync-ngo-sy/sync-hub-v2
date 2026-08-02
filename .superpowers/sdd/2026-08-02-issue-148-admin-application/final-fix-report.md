# Final fix report

Base reviewed: `dc8ba19`.

## Changed files

- `apps/admin-portal/src/lib/portal-destination.ts`
- `apps/admin-portal/src/lib/portal-destination.test.ts`
- `apps/admin-portal/src/routes/index.tsx`
- `apps/admin-portal/src/routes/forgot-password.tsx`
- `apps/admin-portal/src/routes/login.tsx`
- `apps/admin-portal/src/features/shell/components/app-shell.tsx`
- `apps/admin-portal/src/features/platform/tenant.ts`
- `apps/candidate-portal/src/lib/env.ts`
- `apps/candidate-portal/src/lib/env.test.ts`
- `apps/recruiter-portal/src/lib/env.ts`
- `apps/recruiter-portal/src/lib/env.test.ts`

## Fixes

- Centralized the admin portal account-to-destination decision in `portalDestination`. All three public admin routes use it, and login supplies the already-sanitized `returnTo` only for platform administrators.
- Removed the unused `PlaceholderPage` component and `CreateTenantValues` alias.
- Hardened candidate and recruiter `VITE_ADMIN_PORTAL_URL` parsing to allow only `http:` and `https:` schemes. The installed Zod `httpUrl()` rejects the required `http://localhost:5175` development default, so the implementation keeps Zod URL parsing and explicitly refines the protocol.

## Verification

- `pnpm --filter @sync/candidate-portal test src/lib/env.test.ts` — 1 file, 2 tests passed.
- `pnpm --filter @sync/recruiter-portal test src/lib/env.test.ts` — 1 file, 2 tests passed.
- `pnpm --filter @sync/admin-portal test src/lib/portal-destination.test.ts src/routes/login.test.tsx` — 2 files, 4 tests passed.
- `pnpm --filter @sync/admin-portal typecheck` — passed.
- `pnpm --filter @sync/candidate-portal typecheck` — passed.
- `pnpm --filter @sync/recruiter-portal typecheck` — passed.
- `pnpm --filter @sync/admin-portal lint` — passed.
- `pnpm --filter @sync/candidate-portal lint` — passed.
- `pnpm --filter @sync/recruiter-portal lint` — passed.
- `pnpm --filter @sync/admin-portal test` — 6 files, 18 tests passed.
- `pnpm --filter @sync/admin-portal build` — passed.
- `git diff --check` — passed.

## Self-review

- `portalDestination` returns `/wrong-portal` for every non-platform-admin profile, ignores `returnTo` for those profiles, and defaults platform administrators to `/overview`; the focused unit test covers each branch.
- Login still passes `returnTo` through `resolveReturnTo` before giving it to the helper, so only previously permitted in-portal paths are retained.
- Candidate and recruiter tests exercise the real validators against both `ftp:` and `javascript:` inputs. The development `localhost` default remains accepted.
- The diff is limited to the four requested review themes, tests, and this report. No concerns remain.
