import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { AppShell } from '@/features/shell/components/app-shell';
import { AppCrash } from '@/features/shell/components/route-error';
import { ShellSkeleton } from '@/features/shell/components/shell-skeleton';
import { askTenantAccess } from '@/features/tenant/access';

export const Route = createFileRoute('/_workspace')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context, location }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) {
      throw redirect({ to: '/login', search: { returnTo: location.href } });
    }
    if (profile.account_type !== 'recruiter') {
      throw redirect({ to: '/wrong-portal' });
    }
    if (await askTenantAccess(context.queryClient)) {
      throw redirect({ to: '/access-refused' });
    }
    return { profile };
  },
  pendingComponent: ShellSkeleton,
  component: WorkspaceLayout,
  errorComponent: AppCrash,
});

function WorkspaceLayout() {
  const { profile } = Route.useRouteContext();
  return (
    <AppShell profile={profile}>
      <Outlet />
    </AppShell>
  );
}
