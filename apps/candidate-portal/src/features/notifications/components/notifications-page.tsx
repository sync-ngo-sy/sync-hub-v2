import { PageHeader } from '@sync/ui/components/page-header';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { Button } from '@sync/ui/components/ui/button';
import { ErrorCard } from '@/features/shell/components/error-card';
import { useMyNotifications } from '../hooks/use-my-notifications';
import { NothingYet } from './nothing-yet';
import { NotificationList } from './notification-list';

export function NotificationsPage() {
  const notifications = useMyNotifications();

  return (
    <div className="space-y-(--space-section)">
      <PageHeader
        title="Notifications"
        description="Everything the platform has told you, newest first. Opening one marks it read."
      />

      {notifications.isPending ? (
        <div role="status" aria-label="Loading your notifications">
          <ListSkeleton rows={5} />
        </div>
      ) : null}

      {notifications.isError && !notifications.data ? (
        <ErrorCard
          title="Couldn't load your notifications"
          description="The list didn't load. Nothing has been lost."
          onRetry={() => void notifications.refetch()}
        />
      ) : null}

      {notifications.data?.length ? <NotificationList notifications={notifications.data} /> : null}
      {notifications.data?.length === 0 ? <NothingYet /> : null}

      {notifications.hasNextPage ? (
        <div className="flex flex-col items-center gap-2">
          {notifications.isFetchNextPageError ? (
            <p className="text-meta text-muted-foreground">
              Couldn't load the next page. The list above is fine.
            </p>
          ) : null}
          <Button
            variant="outline"
            onClick={() => void notifications.fetchNextPage()}
            disabled={notifications.isFetchingNextPage}
          >
            {notifications.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
