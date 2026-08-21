import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { AppShell } from '@/features/shell/components/app-shell';
import { ShellSkeleton } from '@/features/shell/components/shell-skeleton';

export const Route = createFileRoute('/_admin')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context, location }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login', search: { returnTo: location.href } });
    if (profile.account_type !== 'platform_admin') throw redirect({ to: '/wrong-portal' });
    return { profile };
  },
  pendingComponent: ShellSkeleton,
  component: () => (
    <AppShell profile={Route.useRouteContext().profile}>
      <Outlet />
    </AppShell>
  ),
});
