import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Suspense } from 'react';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';
import { AppShell } from '@/features/shell/components/app-shell';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { AppCrash } from '@/features/shell/components/route-error';

export const Route = createFileRoute('/_account')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context, location }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) {
      throw redirect({ to: '/login', search: { returnTo: location.href } });
    }
    if (!isCandidate(profile)) {
      throw redirect({ to: '/wrong-portal' });
    }
    return { profile };
  },
  component: AccountLayout,
  errorComponent: AppCrash,
});

function AccountLayout() {
  const { profile } = Route.useRouteContext();
  return (
    <AppShell profile={profile}>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
