import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';

export async function bounceSignedIn({
  context,
}: {
  context: { queryClient: QueryClient };
}): Promise<void> {
  const profile = await ensureCurrentProfile(context.queryClient);
  if (!profile) return;
  throw isCandidate(profile)
    ? redirect({ to: '/applications' })
    : redirect({ to: '/wrong-portal' });
}
