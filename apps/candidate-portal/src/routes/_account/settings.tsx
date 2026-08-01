import { createFileRoute } from '@tanstack/react-router';
import { AccountSettingsPage } from '@/features/settings/components/account-settings-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/settings')({
  head: () => ({ meta: [{ title: pageTitle('Account settings') }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile } = Route.useRouteContext();
  return <AccountSettingsPage profile={profile} />;
}
