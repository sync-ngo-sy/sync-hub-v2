import { createFileRoute, redirect } from '@tanstack/react-router';
import { WrongPortalScreen } from '@/features/auth/components/wrong-portal-screen';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/wrong-portal')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    if (profile.account_type === 'recruiter') throw redirect({ to: '/dashboard' });
    return { profile };
  },
  head: () => ({ meta: [{ title: pageTitle('Wrong portal') }] }),
  component: WrongPortalPage,
});

function WrongPortalPage() {
  const { profile } = Route.useRouteContext();
  return <WrongPortalScreen accountType={profile.account_type} />;
}
