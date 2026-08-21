import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { AuthScreen, AuthScreenSkeleton } from '@/features/auth/components/auth-screen';
import { DeadLinkScreen } from '@/features/auth/components/dead-link-screen';
import { NewPasswordForm } from '@/features/auth/components/new-password-form';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: z.object({ token_hash: z.string().optional() }),
  head: () => ({ meta: [{ title: pageTitle('Choose a new password') }] }),
  pendingComponent: () => <AuthScreenSkeleton fields={1} />,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token_hash: tokenHash } = Route.useSearch();
  const navigate = useNavigate();
  const [deadLink, setDeadLink] = useState(false);

  if (!tokenHash || deadLink) {
    return (
      <DeadLinkScreen
        description="Password-reset links expire, and each one works only once. Ask for a new one and we'll email it."
        action={{ to: '/forgot-password', label: 'Send a new link' }}
      />
    );
  }

  return (
    <AuthScreen
      title="Choose a new password"
      description="Setting it signs out everywhere, so you'll sign in once more with the new one."
    >
      <NewPasswordForm
        tokenHash={tokenHash}
        onReset={() => {
          toast.success('Password updated. Sign in with your new password.');
          void navigate({ to: '/login' });
        }}
        onDeadLink={() => setDeadLink(true)}
      />
    </AuthScreen>
  );
}
