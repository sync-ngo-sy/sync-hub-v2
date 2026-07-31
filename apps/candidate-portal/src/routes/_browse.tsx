import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Suspense } from 'react';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';
import { AppShell } from '@/features/shell/components/app-shell';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { PublicShell } from '@/features/shell/components/public-shell';
import { AppCrash } from '@/features/shell/components/route-error';

export const Route = createFileRoute('/_browse')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    // Browsing is open to anyone, so no session is turned away here. A recruiter still is:
    // candidate chrome around a recruiter's account would misrepresent where they are.
    if (profile && !isCandidate(profile)) throw redirect({ to: '/wrong-portal' });
    return { profile };
  },
  component: BrowseLayout,
  errorComponent: AppCrash,
});

function BrowseLayout() {
  const { profile } = Route.useRouteContext();
  const content = (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  );

  return profile ? (
    <AppShell profile={profile}>{content}</AppShell>
  ) : (
    <PublicShell>{content}</PublicShell>
  );
}
