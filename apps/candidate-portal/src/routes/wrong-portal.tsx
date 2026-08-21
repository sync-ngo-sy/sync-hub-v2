import { createFileRoute, redirect } from '@tanstack/react-router';
import { WrongPortalScreen } from '@/features/auth/components/wrong-portal-screen';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';
import { CenteredSkeleton } from '@/features/shell/components/centered-skeleton';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/wrong-portal')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    if (isCandidate(profile)) throw redirect({ to: '/applications' });
    return { profile };
  },
  head: () => ({ meta: [{ title: pageTitle('Wrong portal') }] }),
  pendingComponent: () => <CenteredSkeleton label="Loading this notice" action />,
  component: WrongPortalPage,
});

function WrongPortalPage() {
  const { profile } = Route.useRouteContext();
  return <WrongPortalScreen accountType={profile.account_type} />;
}
