import { buttonVariants } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/check-email')({
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({ meta: [{ title: pageTitle('Check your email') }] }),
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { email } = Route.useSearch();

  return (
    <AuthScreen
      title="Check your email"
      description={
        <>
          We sent a confirmation link to{' '}
          {email ? <strong className="font-medium text-foreground">{email}</strong> : 'your inbox'}.
          Open it to activate your account and sign in. It can take a minute to arrive — check your
          spam folder too.
        </>
      }
    >
      <div>
        <Link to="/login" className={buttonVariants({ variant: 'outline' })}>
          Back to sign in
        </Link>
      </div>
    </AuthScreen>
  );
}
