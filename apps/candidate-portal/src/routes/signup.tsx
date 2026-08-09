import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { AUTH_LINK, AuthScreen } from '@/features/auth/components/auth-screen';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import { pageTitle } from '@/lib/page-title';
import { bounceSignedIn } from './-public-only';

export const Route = createFileRoute('/signup')({
  beforeLoad: bounceSignedIn,
  head: () => ({ meta: [{ title: pageTitle('Create your account') }] }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();

  return (
    <AuthScreen
      title="Create your account"
      description="One profile, every application you send."
      sideRail
    >
      <SignUpForm
        onSignedUp={(email) => {
          void navigate({ to: '/check-email', search: { email } });
        }}
      />
      <p className="max-w-sm text-center text-dense text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </AuthScreen>
  );
}
