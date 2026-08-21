import { createFileRoute } from '@tanstack/react-router';
import { AccountSettingsPage } from '@/features/auth/components/account-settings-page';
import { AccountSettingsSkeleton } from '@/features/auth/components/account-settings-skeleton';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/account')({
  head: () => ({ meta: [{ title: pageTitle('Account settings') }] }),
  pendingComponent: AccountSettingsSkeleton,
  component: AccountPage,
});

function AccountPage() {
  const { profile } = Route.useRouteContext();
  return <AccountSettingsPage profile={profile} />;
}
