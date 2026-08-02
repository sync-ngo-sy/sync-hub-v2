import { createFileRoute, redirect } from '@tanstack/react-router';
import { ForgotPasswordScreen } from '@/features/auth/components';
import { ensureCurrentProfile } from '@/features/auth/current-profile';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (profile)
      throw redirect({
        to: profile.account_type === 'platform_admin' ? '/overview' : '/wrong-portal',
      });
  },
  component: ForgotPasswordScreen,
});
