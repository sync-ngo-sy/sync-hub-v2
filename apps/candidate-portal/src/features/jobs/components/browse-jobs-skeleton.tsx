import {
  ListSkeleton,
  PageHeaderSkeleton,
  RouteSkeleton,
  ToolbarSkeleton,
} from '@sync/ui/components/skeletons';

export function BrowseJobsSkeleton() {
  return (
    <RouteSkeleton label="Loading jobs" className="space-y-(--space-section)">
      <PageHeaderSkeleton />
      <ToolbarSkeleton controls={3} />
      <ListSkeleton rows={6} />
    </RouteSkeleton>
  );
}
