import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { useOpenNotification } from '../hooks/use-open-notification';
import { type Notification, notificationCopy } from '../notification';
import { NOTIFICATION_ROW, NotificationItem } from './notification-item';

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const open = useOpenNotification();

  return (
    <ul aria-label="Notifications" className="divide-y divide-border border-t border-border">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <Link
            to={notificationCopy(notification).to}
            onClick={() => open(notification)}
            className={cn(
              NOTIFICATION_ROW,
              'py-5 hover:text-accent-foreground',
              'focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            )}
          >
            <NotificationItem notification={notification} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
