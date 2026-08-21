import { createFileRoute, redirect } from '@tanstack/react-router';
import { ScreenSkeleton } from '@/features/auth/components';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { portalDestination } from '@/lib/portal-destination';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    throw redirect({ to: portalDestination(profile) });
  },
  pendingComponent: () => <ScreenSkeleton fields={0} submit={false} />,
});
