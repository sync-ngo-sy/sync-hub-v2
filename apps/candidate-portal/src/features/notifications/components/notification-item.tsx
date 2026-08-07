import { cn } from '@sync/ui/lib/utils';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { isUnread, type Notification, notificationCopy } from '../notification';

export const NOTIFICATION_ROW = 'flex items-start gap-3';

export function NotificationItem({ notification }: { notification: Notification }) {
  const { headline, detail, icon: Icon } = notificationCopy(notification);
  const unread = isUnread(notification);

  return (
    <>
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-4.5 shrink-0',
          unread ? 'text-accent-foreground' : 'text-muted-foreground',
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            'text-wrap',
            unread ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {unread ? <span className="sr-only">Unread. </span> : null}
          {headline}
        </span>
        <span className="text-meta text-muted-foreground">{detail}</span>
        <time
          dateTime={notification.created_at}
          title={absoluteDateTime(notification.created_at)}
          className="text-meta text-muted-foreground"
        >
          {relativeTime(notification.created_at)}
        </time>
      </span>
      {unread ? (
        <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      ) : null}
    </>
  );
}
