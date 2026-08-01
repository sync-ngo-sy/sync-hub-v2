import { buttonVariants } from '@sync/ui/components/ui/button';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { rememberCurrentProfile } from '@/features/auth/current-profile';
import { client } from '@/lib/api';
import { isClientError } from '@/lib/api-problem';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/auth/confirm')({
  validateSearch: z.object({ token_hash: z.string().optional() }),
  loaderDeps: ({ search }) => ({ tokenHash: search.token_hash }),
  // Redeeming from the loader, not an effect: the router runs it once per arrival, where
  // StrictMode would spend the token twice.
  loader: async ({ context, deps }) => {
    if (!deps.tokenHash) return;
    const { data, error } = await client.POST('/v1/auth/confirm-email', {
      body: { token_hash: deps.tokenHash },
    });
    if (data) {
      rememberCurrentProfile(context.queryClient, data);
      throw redirect({ to: '/applications' });
    }
    if (!isClientError(error)) throw error;
  },
  pendingComponent: () => <AuthScreen title="Confirming your email…" />,
  head: () => ({ meta: [{ title: pageTitle('Confirm your email') }] }),
  component: DeadLinkPage,
});

function DeadLinkPage() {
  return (
    <AuthScreen
      title="This link didn't work"
      description="Confirmation links expire, and each one works only once. If you have already confirmed this address, sign in — your account is ready."
    >
      <div>
        <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
          Go to sign in
        </Link>
      </div>
    </AuthScreen>
  );
}
