import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { AUTH_LINK, AuthScreen, AuthScreenSkeleton } from '@/features/auth/components/auth-screen';
import { CheckEmailScreen, SentTo } from '@/features/auth/components/check-email-screen';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { pageTitle } from '@/lib/page-title';
import { bounceSignedIn } from './-public-only';

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: bounceSignedIn,
  head: () => ({ meta: [{ title: pageTitle('Reset your password') }] }),
  pendingComponent: () => <AuthScreenSkeleton fields={1} />,
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo !== null) {
    return (
      <CheckEmailScreen>
        If an account exists for <SentTo email={sentTo} />, a link to choose a new password is on
        its way. It can take a minute to arrive — check your spam folder too.
      </CheckEmailScreen>
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
