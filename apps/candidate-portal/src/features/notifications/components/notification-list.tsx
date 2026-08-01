import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { useOpenNotification } from '../hooks/use-mark-read';
import { type Notification, notificationCopy } from '../notification';
import { NotificationItem } from './notification-item';

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
              'flex items-start gap-3 py-5 hover:text-accent-foreground',
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
