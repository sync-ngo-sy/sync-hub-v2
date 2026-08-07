import { SkeletonText } from '@sync/ui/components/skeletons';
import { Button } from '@sync/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useMyNotifications } from '../hooks/use-my-notifications';
import { useOpenNotification } from '../hooks/use-open-notification';
import { useUnreadCount } from '../hooks/use-unread-count';
import { NOTHING_YET, notificationCopy, RECENT_NOTIFICATIONS } from '../notification';
import { NOTIFICATION_ROW, NotificationItem } from './notification-item';

export function NotificationBell() {
  const unread = useUnreadCount();
  const count = unread.data?.unread ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      >
        <Bell />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[0.625rem] leading-4 font-semibold text-primary-foreground"
          >
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))]">
        <Recent />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Recent() {
  const notifications = useMyNotifications();
  const open = useOpenNotification();
  const recent = notifications.data?.slice(0, RECENT_NOTIFICATIONS) ?? [];

  return (
    <>
      {notifications.isPending ? (
        <div role="status" aria-label="Loading your notifications" className="px-1.5 py-2">
          <SkeletonText lines={3} />
        </div>
      ) : null}

      {notifications.isError && !notifications.data ? (
        <DropdownMenuItem closeOnClick={false} onClick={() => void notifications.refetch()}>
          Couldn't load these. Try again
        </DropdownMenuItem>
      ) : null}

      {notifications.data?.length === 0 ? (
        <p className="px-1.5 py-2 text-dense text-muted-foreground">{NOTHING_YET}</p>
      ) : null}

      {recent.map((notification) => (
        <DropdownMenuItem
          key={notification.id}
          render={<Link to={notificationCopy(notification).to} />}
          onClick={() => open(notification)}
          className={cn(NOTIFICATION_ROW, 'py-2')}
        >
          <NotificationItem notification={notification} />
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />
      <DropdownMenuItem render={<Link to="/notifications" />}>
        View all notifications
      </DropdownMenuItem>
    </>
  );
}
