import { createFileRoute } from '@tanstack/react-router';
import { AccountSettingsPage } from '@/features/auth/components/account-settings-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/account')({
  head: () => ({ meta: [{ title: pageTitle('Account settings') }] }),
  component: AccountPage,
});

function AccountPage() {
  const { profile } = Route.useRouteContext();
  return <AccountSettingsPage profile={profile} />;
}
