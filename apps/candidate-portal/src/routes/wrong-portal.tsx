import { createFileRoute, redirect } from '@tanstack/react-router';
import { WrongPortalScreen } from '@/features/auth/components/wrong-portal-screen';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/wrong-portal')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    if (isCandidate(profile)) throw redirect({ to: '/applications' });
  },
  head: () => ({ meta: [{ title: pageTitle('Wrong portal') }] }),
  component: WrongPortalScreen,
});
