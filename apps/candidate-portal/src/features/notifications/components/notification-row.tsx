import type { components } from '@sync/api-client/schema';
import { StatusChip } from '@sync/ui/components/status-chip';
import { cn } from '@sync/ui/lib/utils';
import { notificationView } from '../lib/notification-view';

type Notification = components['schemas']['Notification'];

/** The visual body of one notification, shared by the bell dropdown and the view-all page. */
export function NotificationRow({ notification }: { notification: Notification }) {
  const view = notificationView(notification.payload);
  const unread = !notification.read_at;

  return (
    <div className="flex w-full items-start gap-3 text-start">
      <span
        aria-hidden
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          unread ? 'bg-primary' : 'bg-transparent',
        )}
      />
      {unread ? <span className="sr-only">Unread. </span> : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'truncate text-sm',
              unread ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {view.title}
          </p>
          {view.status ? <StatusChip status={view.status} /> : null}
        </div>
        <p className="text-xs text-muted-foreground">{view.description}</p>
      </div>
    </div>
  );
}
