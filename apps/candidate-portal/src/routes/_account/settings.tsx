import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/settings')({
  head: () => ({ meta: [{ title: pageTitle('Account settings') }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return <PlaceholderPage title="Account settings" />;
}
