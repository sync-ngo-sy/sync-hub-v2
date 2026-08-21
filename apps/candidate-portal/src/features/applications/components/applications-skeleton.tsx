import { ListSkeleton, PageHeaderSkeleton, RouteSkeleton } from '@sync/ui/components/skeletons';

export function ApplicationsSkeleton() {
  return (
    <RouteSkeleton label="Loading your Applications" className="space-y-(--space-section)">
      <PageHeaderSkeleton />
      <ListSkeleton rows={5} />
    </RouteSkeleton>
  );
}
