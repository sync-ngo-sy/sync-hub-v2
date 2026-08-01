import { buttonVariants } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { AUTH_LINK, AuthScreen } from '@/features/auth/components/auth-screen';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: pageTitle('Reset your password') }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo !== null) {
    return (
      <AuthScreen
        title="Check your email"
        description={
          <>
            If an account exists for{' '}
            <strong className="font-medium text-foreground">{sentTo}</strong>, a link to choose a
            new password is on its way. It can take a minute to arrive — check your spam folder too.
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

  return (
    <AuthScreen
      title="Reset your password"
      description="Tell us the address you signed up with and we'll email you a link to choose a new password."
    >
      <ForgotPasswordForm onSent={setSentTo} />
      <p className="text-center text-dense text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </AuthScreen>
  );
}
