import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { LogInForm } from '@/features/auth/components/log-in-form';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { PublicHeader } from '@/features/shell/components/public-header';
import { pageTitle } from '@/lib/page-title';
import { resolveReturnTo } from '@/lib/return-to';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  beforeLoad: async ({ context, search }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (profile?.account_type !== 'recruiter') return;
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
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12">
        <div className="space-y-1.5">
          <h1 className="font-heading text-h3 text-foreground">Sign in</h1>
          <p className="text-dense text-muted-foreground">
            Manage your workspace's jobs, applications and team.
          </p>
        </div>
        <LogInForm
          onSignedIn={() => {
            void (destination ? navigate({ href: destination }) : navigate({ to: '/dashboard' }));
          }}
        />
      </main>
    </div>
  );
}
