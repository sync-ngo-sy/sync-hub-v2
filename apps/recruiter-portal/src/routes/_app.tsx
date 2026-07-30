import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { Suspense } from 'react';
import { WrongPortalScreen } from '@/features/auth/components/wrong-portal-screen';
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
    return { profile };
  },
  component: AppLayout,
  // The guard itself failing leaves no shell to render the error inside.
  errorComponent: AppCrash,
});

function AppLayout() {
  const { profile } = Route.useRouteContext();

  if (profile.account_type !== 'recruiter') {
    return <WrongPortalScreen />;
  }

  return (
    <AppShell profile={profile}>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
