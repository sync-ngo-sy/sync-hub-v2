import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { Button } from '@sync/ui/components/ui/button';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { createFileRoute } from '@tanstack/react-router';
import { BellOff, LoaderCircle } from 'lucide-react';
import { NotificationRow } from '../features/notifications/components/notification-row';
import { useNotifications } from '../features/notifications/hooks/use-notifications';
import { useOpenNotification } from '../features/notifications/hooks/use-open-notification';

export const Route = createFileRoute('/_authed/notifications')({
  component: NotificationsPage,
});

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e'];

function NotificationsPage() {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotifications();
  const open = useOpenNotification();
  const items = data?.pages.flatMap((page) => page?.items ?? []) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Notifications" description="Updates about your CVs and applications." />

      {isPending ? (
        <ul className="space-y-2" aria-busy="true">
          {SKELETON_KEYS.map((key) => (
            <li key={key}>
              <Skeleton className="h-16 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
        >
          <span className="text-sm text-foreground">Couldn't load your notifications.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellOff />}
          title="No notifications yet"
          description="When one of your CVs finishes parsing or an application moves, you'll hear about it here."
        />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {items.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className="flex w-full px-4 py-3.5 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <NotificationRow notification={notification} />
                </button>
              </li>
            ))}
          </ul>
          {hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? <LoaderCircle className="animate-spin" /> : null}
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
