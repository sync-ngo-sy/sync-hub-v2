import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { DeadLinkScreen } from '@/features/auth/components/dead-link-screen';
import { rememberCurrentProfile } from '@/features/auth/current-profile';
import { DEAD_LINK_PROBLEM } from '@/features/auth/problems';
import { client } from '@/lib/api';
import { isProblem } from '@/lib/api-problem';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/auth/confirm')({
  validateSearch: z.object({ token_hash: z.string().optional() }),
  loaderDeps: ({ search }) => ({ tokenHash: search.token_hash }),
  loader: async ({ context, deps }) => {
    if (!deps.tokenHash) return;
    const { data, error } = await client.POST('/v1/auth/confirm-email', {
      body: { token_hash: deps.tokenHash },
    });
    if (data) {
      rememberCurrentProfile(context.queryClient, data);
      throw redirect({ to: '/applications' });
    }
    if (!isProblem(error, DEAD_LINK_PROBLEM)) throw error;
  },
  pendingComponent: () => <AuthScreen title="Confirming your email…" />,
  head: () => ({ meta: [{ title: pageTitle('Confirm your email') }] }),
  component: () => (
    <DeadLinkScreen
      description="Confirmation links expire, and each one works only once. If you have already confirmed this address, sign in — your account is ready."
      action={{ to: '/login', label: 'Go to sign in' }}
    />
  ),
});
