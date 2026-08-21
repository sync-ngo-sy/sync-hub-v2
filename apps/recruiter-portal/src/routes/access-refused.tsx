import { createFileRoute, redirect } from '@tanstack/react-router';
import { ensureCurrentProfile } from '@/features/auth/current-profile';
import { askTenantAccess } from '@/features/tenant/access';
import { AccessRefusedScreen } from '@/features/tenant/components/access-refused-screen';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/access-refused')({
  staticData: { requiresSession: true },
  beforeLoad: async ({ context }) => {
    const profile = await ensureCurrentProfile(context.queryClient);
    if (!profile) throw redirect({ to: '/login' });
    if (profile.account_type !== 'recruiter') throw redirect({ to: '/wrong-portal' });
    const refusal = await askTenantAccess(context.queryClient);
    if (!refusal) throw redirect({ to: '/dashboard' });
    return { refusal };
  },
  head: () => ({ meta: [{ title: pageTitle('No access') }] }),
  component: AccessRefusedPage,
});

function AccessRefusedPage() {
  const { refusal } = Route.useRouteContext();
  return <AccessRefusedScreen refusal={refusal} />;
}
