import { createFileRoute, redirect } from '@tanstack/react-router';
import { ScreenSkeleton, WrongPortalScreen } from '@/features/auth/components';
import { ensureCurrentProfile } from '@/features/auth/current-profile';

export const Route = createFileRoute('/wrong-portal')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    if (profile.account_type === 'platform_admin') throw redirect({ to: '/overview' });
    return { profile };
  },
  pendingComponent: () => <ScreenSkeleton fields={0} submit={false} action />,
  component: () => <WrongPortalScreen accountType={Route.useRouteContext().profile.account_type} />,
});
