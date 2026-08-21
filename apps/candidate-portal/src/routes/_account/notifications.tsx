import { createFileRoute } from '@tanstack/react-router';
import { NotificationsPage } from '@/features/notifications/components/notifications-page';
import { NotificationsSkeleton } from '@/features/notifications/components/notifications-skeleton';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_account/notifications')({
  head: () => ({ meta: [{ title: pageTitle('Notifications') }] }),
  pendingComponent: NotificationsSkeleton,
  component: NotificationsPage,
});
