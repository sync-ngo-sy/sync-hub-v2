import { SkeletonText } from '@sync/ui/components/skeletons';
import { Button } from '@sync/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useOpenNotification } from '../hooks/use-mark-read';
import { useMyNotifications } from '../hooks/use-my-notifications';
import { useUnreadCount } from '../hooks/use-unread-count';
import { notificationCopy, RECENT_NOTIFICATIONS } from '../notification';
import { NotificationItem } from './notification-item';

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
          // The number is decoration: the trigger's own name already carries it in words.
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

/** Mounted with the dropdown, so the list is fetched when a reader asks for it rather than on
 * every page the bell sits on. */
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

      {notifications.isError ? (
        <div className="flex flex-col items-start gap-2 px-1.5 py-2">
          <p className="text-dense text-muted-foreground">Couldn't load these.</p>
          <Button variant="outline" size="sm" onClick={() => void notifications.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      {notifications.data?.length === 0 ? (
        <p className="px-1.5 py-2 text-dense text-muted-foreground">
          Nothing yet. Applications and CVs report in here.
        </p>
      ) : null}

      {recent.map((notification) => (
        <DropdownMenuItem
          key={notification.id}
          render={<Link to={notificationCopy(notification).to} />}
          onClick={() => open(notification)}
          className="items-start gap-3 py-2"
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
