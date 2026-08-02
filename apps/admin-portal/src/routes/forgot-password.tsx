import { createFileRoute, redirect } from '@tanstack/react-router';
import { ForgotPasswordScreen } from '@/features/auth/components';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { portalDestination } from '@/lib/portal-destination';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (profile) throw redirect({ to: portalDestination(profile) });
  },
  component: ForgotPasswordScreen,
});
