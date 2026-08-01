import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { AcceptInviteForm } from '@/features/auth/components/accept-invite-form';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { DeadLinkScreen } from '@/features/auth/components/dead-link-screen';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/auth/accept-invite')({
  validateSearch: z.object({ token_hash: z.string().optional() }),
  head: () => ({ meta: [{ title: pageTitle('Join your workspace') }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token_hash: tokenHash } = Route.useSearch();
  const navigate = useNavigate();
  const [deadLink, setDeadLink] = useState(false);

  if (!tokenHash || deadLink) {
    return (
      <DeadLinkScreen
        description="Invitation links expire, and each one works only once. Ask your workspace admin for a new invitation."
        action={{ to: '/login', label: 'Go to sign in' }}
      />
    );
  }

  return (
    <AuthScreen
      title="Join your workspace"
      description="Choose the password you'll use to sign in."
    >
      <AcceptInviteForm
        tokenHash={tokenHash}
        onAccepted={() => {
          void navigate({ to: '/dashboard' });
        }}
        onDeadLink={() => setDeadLink(true)}
      />
    </AuthScreen>
  );
}
