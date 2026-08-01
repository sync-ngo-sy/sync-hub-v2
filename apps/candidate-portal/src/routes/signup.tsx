import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { AUTH_LINK, AuthScreen } from '@/features/auth/components/auth-screen';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import { ensureCurrentProfile, isCandidate } from '@/features/auth/current-profile';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) return;
    throw isCandidate(profile)
      ? redirect({ to: '/applications' })
      : redirect({ to: '/wrong-portal' });
  },
  head: () => ({ meta: [{ title: pageTitle('Create your account') }] }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();

  return (
    <AuthScreen title="Create your account" description="One profile, every application you send.">
      <SignUpForm
        onSignedUp={(email) => {
          void navigate({ to: '/check-email', search: { email } });
        }}
      />
      <p className="text-center text-dense text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </AuthScreen>
  );
}
