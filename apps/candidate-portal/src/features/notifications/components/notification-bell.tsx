import { EmptyState } from '@sync/ui/components/empty-state';
import { Button } from '@sync/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sync/ui/components/ui/dropdown-menu';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { Link } from '@tanstack/react-router';
import { Bell, BellOff } from 'lucide-react';
import { useState } from 'react';
import { useNotifications } from '../hooks/use-notifications';
import { useOpenNotification } from '../hooks/use-open-notification';
import { useUnreadCount } from '../hooks/use-unread-count';
import { NotificationRow } from './notification-row';

const DROPDOWN_LIMIT = 6;
const SKELETON_KEYS = ['a', 'b', 'c'];

function bellLabel(unread: number): string {
  return unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
}

function RecentNotifications({ onOpen }: { onOpen: () => void }) {
  const { data, isPending, isError, refetch } = useNotifications();
  const open = useOpenNotification();
  const recent = data?.pages.flatMap((page) => page?.items ?? []).slice(0, DROPDOWN_LIMIT) ?? [];

  if (isPending) {
    return (
      <div className="space-y-1 p-1">
        {SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-2 px-2 py-3 text-sm"
      >
        <span className="text-muted-foreground">Couldn't load notifications.</span>
        <Button variant="outline" size="xs" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (recent.length === 0) {
    return (
      <EmptyState
        className="border-none py-8"
        icon={<BellOff />}
        title="You're all caught up"
        description="Updates about your CVs and applications show up here."
      />
    );
  }

  return (
    <>
      {recent.map((notification) => (
        <DropdownMenuItem
          key={notification.id}
          className="items-start py-2"
          onClick={() => {
            open(notification);
            onOpen();
          }}
        >
          <NotificationRow notification={notification} />
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** The bell in the app header: an unread badge over a dropdown of the most recent notifications. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useUnreadCount();
  const unread = data?.unread ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={bellLabel(unread)} className="relative">
            <Bell aria-hidden />
            {unread > 0 ? (
              <span
                aria-hidden
                className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-medium leading-none text-primary-foreground tabular-nums"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Notifications</div>
        <RecentNotifications onOpen={() => setOpen(false)} />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm font-medium"
          render={<Link to="/notifications" />}
        >
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
