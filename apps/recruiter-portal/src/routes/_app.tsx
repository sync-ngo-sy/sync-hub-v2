import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Suspense } from 'react';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { AppShell } from '@/features/shell/components/app-shell';
import { PageSkeleton } from '@/features/shell/components/page-skeleton';
import { AppCrash } from '@/features/shell/components/route-error';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) {
      throw redirect({ to: '/login', search: { returnTo: location.href } });
    }
    // Turned away here rather than in the component, so none of the workspace's own loaders
    // ever run for an account that does not belong in it.
    if (profile.account_type !== 'recruiter') {
      throw redirect({ to: '/wrong-portal' });
    }
    return { profile };
  },
  component: AppLayout,
  errorComponent: AppCrash,
});

function AppLayout() {
  const { profile } = Route.useRouteContext();
  return (
    <AppShell profile={profile}>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
