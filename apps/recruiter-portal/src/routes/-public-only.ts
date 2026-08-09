import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { ensureCurrentProfile } from '@/features/auth/current-profile';

export async function bounceSignedIn({
  context,
}: {
  context: { queryClient: QueryClient };
}): Promise<void> {
  const profile = await ensureCurrentProfile(context.queryClient).catch(() => null);
  if (!profile) return;
  throw profile.account_type === 'recruiter'
    ? redirect({ to: '/dashboard' })
    : redirect({ to: '/wrong-portal' });
}
