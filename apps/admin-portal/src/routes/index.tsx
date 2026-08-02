import { createFileRoute, redirect } from '@tanstack/react-router';
import { ensureCurrentProfile } from '@/features/auth/current-profile';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    throw redirect({
      to: profile.account_type === 'platform_admin' ? '/overview' : '/wrong-portal',
    });
  },
});
