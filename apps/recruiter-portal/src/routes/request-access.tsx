import { buttonVariants } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { RequestAccessForm } from '@/features/access/components/request-access-form';
import { AUTH_LINK, AuthScreen } from '@/features/auth/components/auth-screen';
import { pageTitle } from '@/lib/page-title';
import { bounceSignedIn } from './-public-only';

export const Route = createFileRoute('/request-access')({
  beforeLoad: bounceSignedIn,
  head: () => ({ meta: [{ title: pageTitle('Request access') }] }),
  component: RequestAccessPage,
});

function RequestAccessPage() {
  const [requested, setRequested] = useState(false);

  if (requested) {
    return (
      <AuthScreen
        title="Request received"
        description="Thanks — the Sync team has your request and will be in touch about setting your company up."
      >
        <div>
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            Back to the home page
          </Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Request access to Sync"
      description="Tell us who you are and we'll set your company up. Sync is not self-service."
    >
      <RequestAccessForm onRequested={() => setRequested(true)} />
      <p className="text-center text-dense text-muted-foreground">
        Already have a workspace?{' '}
        <Link to="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </AuthScreen>
  );
}
