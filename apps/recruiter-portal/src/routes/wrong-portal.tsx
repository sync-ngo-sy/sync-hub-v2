import { createFileRoute, redirect } from '@tanstack/react-router';
import { WrongPortalScreen } from '@/features/auth/components/wrong-portal-screen';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/wrong-portal')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    if (profile.account_type === 'recruiter') throw redirect({ to: '/dashboard' });
  },
  head: () => ({ meta: [{ title: pageTitle('Wrong portal') }] }),
  component: WrongPortalScreen,
});
