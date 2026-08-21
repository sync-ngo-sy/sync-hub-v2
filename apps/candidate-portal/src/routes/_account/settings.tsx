import { createFileRoute } from '@tanstack/react-router';
import { AccountSettingsPage } from '@/features/settings/components/account-settings-page';
import { AccountSettingsSkeleton } from '@/features/settings/components/account-settings-skeleton';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/settings')({
  head: () => ({ meta: [{ title: pageTitle('Account settings') }] }),
  pendingComponent: AccountSettingsSkeleton,
  component: SettingsPage,
});

function SettingsPage() {
  const { profile } = Route.useRouteContext();
  return <AccountSettingsPage profile={profile} />;
}
