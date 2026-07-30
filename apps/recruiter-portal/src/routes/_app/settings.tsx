import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const Route = createFileRoute('/_app/settings')({
  head: () => ({ meta: [{ title: 'Settings · Sync Recruiter' }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return <PlaceholderPage title="Settings" />;
}
