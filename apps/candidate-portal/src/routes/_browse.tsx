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
