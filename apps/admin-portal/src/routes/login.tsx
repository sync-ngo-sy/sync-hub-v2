import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { SignInScreen } from '@/features/auth/components';
import { ensureCurrentProfile } from '@/features/auth/current-profile';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (profile)
      throw redirect({
        to: profile.account_type === 'platform_admin' ? '/overview' : '/wrong-portal',
      });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  return (
    <SignInScreen
      onSignedIn={(profile) => {
        void navigate({
          href:
            profile.account_type === 'platform_admin' &&
            returnTo?.startsWith('/') &&
            !returnTo.startsWith('//')
              ? returnTo
              : profile.account_type === 'platform_admin'
                ? '/overview'
                : '/wrong-portal',
        });
      }}
    />
  );
}
