import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';
import { AppShell } from '@/features/shell/components/app-shell';
import { AppCrash } from '@/features/shell/components/route-error';
import { AccountShellSkeleton } from '@/features/shell/components/shell-skeleton';

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
  pendingComponent: AccountShellSkeleton,
  component: AccountLayout,
  errorComponent: AppCrash,
});

function AccountLayout() {
  const { profile } = Route.useRouteContext();
  return (
    <AppShell profile={profile}>
      <Outlet />
    </AppShell>
  );
}
