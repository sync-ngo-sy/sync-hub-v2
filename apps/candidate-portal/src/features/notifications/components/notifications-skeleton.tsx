import { ListSkeleton, PageHeaderSkeleton, RouteSkeleton } from '@sync/ui/components/skeletons';

export function NotificationsSkeleton() {
  return (
    <RouteSkeleton label="Loading your notifications" className="space-y-(--space-section)">
      <PageHeaderSkeleton />
      <ListSkeleton rows={5} />
    </RouteSkeleton>
  );
}
