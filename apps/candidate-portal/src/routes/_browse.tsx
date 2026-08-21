import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';
import { AppShell } from '@/features/shell/components/app-shell';
import { PublicShell } from '@/features/shell/components/public-shell';
import { AppCrash } from '@/features/shell/components/route-error';
import { BrowseShellSkeleton } from '@/features/shell/components/shell-skeleton';

export const Route = createFileRoute('/_browse')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (profile && !isCandidate(profile)) throw redirect({ to: '/wrong-portal' });
    return { profile };
  },
  pendingComponent: BrowseShellSkeleton,
  component: BrowseLayout,
  errorComponent: AppCrash,
});

function BrowseLayout() {
  const { profile } = Route.useRouteContext();

  return profile ? (
    <AppShell profile={profile}>
      <Outlet />
    </AppShell>
  ) : (
    <PublicShell>
      <Outlet />
    </PublicShell>
  );
}
