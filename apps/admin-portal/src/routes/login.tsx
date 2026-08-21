import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { ScreenSkeleton, SignInScreen } from '@/features/auth/components';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { portalDestination } from '@/lib/portal-destination';
import { resolveReturnTo } from '@/lib/return-to';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (profile) throw redirect({ to: portalDestination(profile) });
  },
  pendingComponent: () => <ScreenSkeleton fields={2} />,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const destination = resolveReturnTo(returnTo);
  return (
    <SignInScreen
      onSignedIn={(profile) => {
        void navigate({ href: portalDestination(profile, destination) });
      }}
    />
  );
}
