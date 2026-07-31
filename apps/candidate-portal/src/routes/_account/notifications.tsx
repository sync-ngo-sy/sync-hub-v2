import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/notifications')({
  head: () => ({ meta: [{ title: pageTitle('Notifications') }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return <PlaceholderPage title="Notifications" />;
}
