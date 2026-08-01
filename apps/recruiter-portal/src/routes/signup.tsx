import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { AUTH_LINK, AuthScreen } from '@/features/auth/components/auth-screen';
import { TenantSignUpForm } from '@/features/auth/components/tenant-sign-up-form';
import { pageTitle } from '@/lib/page-title';
import { bounceSignedIn } from './-public-only';

export const Route = createFileRoute('/signup')({
  beforeLoad: bounceSignedIn,
  head: () => ({ meta: [{ title: pageTitle('Create your workspace') }] }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();

  return (
    <AuthScreen
      title="Create your workspace"
      description="Set up your hiring workspace and its founding admin account."
    >
      <TenantSignUpForm
        onSignedUp={(email) => {
          void navigate({ to: '/check-email', search: { email } });
        }}
      />
      <p className="text-center text-dense text-muted-foreground">
        Already have a workspace?{' '}
        <Link to="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </AuthScreen>
  );
}
