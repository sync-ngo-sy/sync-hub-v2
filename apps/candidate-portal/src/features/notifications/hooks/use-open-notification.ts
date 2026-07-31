import type { components } from '@sync/api-client/schema';
import { useNavigate } from '@tanstack/react-router';
import { notificationView } from '../lib/notification-view';
import { useMarkNotificationRead } from './use-mark-read';

type Notification = components['schemas']['Notification'];

/** Opening a notification marks it read (if unread) and navigates to its deep link. */
export function useOpenNotification() {
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();

  return (notification: Notification) => {
    if (!notification.read_at) void markRead(notification.id);
    void navigate({ href: notificationView(notification.payload).to });
  };
}
