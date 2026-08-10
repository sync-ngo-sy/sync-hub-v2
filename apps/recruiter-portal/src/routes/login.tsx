import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { AUTH_LINK, AuthScreen } from '@/features/auth/components/auth-screen';
import { LogInForm } from '@/features/auth/components/log-in-form';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { pageTitle } from '@/lib/page-title';
import { resolveReturnTo } from '@/lib/return-to';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: async ({ context, search }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) return;
    if (profile.account_type !== 'recruiter') throw redirect({ to: '/wrong-portal' });
    const returnTo = resolveReturnTo(search.returnTo);
    throw returnTo ? redirect({ href: returnTo }) : redirect({ to: '/dashboard' });
  },
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
  component: LogInPage,
});

function LogInPage() {
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const destination = resolveReturnTo(returnTo);

  return (
    <AuthScreen title="Sign in" description="Manage your workspace's jobs, applications and team.">
      <LogInForm
        onSignedIn={() => {
          void (destination ? navigate({ href: destination }) : navigate({ to: '/dashboard' }));
        }}
      />
      <div className="space-y-2 text-center text-dense text-muted-foreground">
        <p>
          <Link to="/forgot-password" className={AUTH_LINK}>
            Forgot your password?
          </Link>
        </p>
        <p>
          New to Sync Hub?{' '}
          <Link to="/request-access" className={AUTH_LINK}>
            Request access
          </Link>
        </p>
      </div>
    </AuthScreen>
  );
}
