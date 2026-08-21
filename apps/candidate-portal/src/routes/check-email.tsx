import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthScreenSkeleton } from '@/features/auth/components/auth-screen';
import { CheckEmailScreen, SentTo } from '@/features/auth/components/check-email-screen';
import { pageTitle } from '@/lib/page-title';
import { bounceSignedIn } from './-public-only';

export const Route = createFileRoute('/check-email')({
  validateSearch: z.object({ email: z.string().optional() }),
  beforeLoad: bounceSignedIn,
  head: () => ({ meta: [{ title: pageTitle('Check your email') }] }),
  pendingComponent: () => <AuthScreenSkeleton fields={0} />,
  component: CheckEmailPage,
});

function CheckEmailPage() {
  const { email } = Route.useSearch();

  return (
    <CheckEmailScreen>
      We sent a confirmation link to {email ? <SentTo email={email} /> : 'your inbox'}. Open it to
      activate your account and sign in. It can take a minute to arrive — check your spam folder
      too.
    </CheckEmailScreen>
  );
}
