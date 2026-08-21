import {
  CardSkeleton,
  FactGridSkeleton,
  PageHeaderSkeleton,
  RouteSkeleton,
} from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';

export function ApplicationReviewSkeleton() {
  return (
    <RouteSkeleton label="Loading this Application">
      <WorkspaceHeader>
        <Skeleton className="h-4 w-56" aria-hidden="true" />
        <PageHeaderSkeleton className="mt-4" action />
      </WorkspaceHeader>

      <div className="pt-(--space-section)">
        <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
          <div className="space-y-(--space-grid)">
            <FactGridSkeleton facts={5} />
            <CardSkeleton lines={3} />
            <CardSkeleton lines={2} />
            <CardSkeleton lines={5} />
          </div>

          <div className="space-y-(--space-grid)">
            <CardSkeleton lines={2} />
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
            <CardSkeleton lines={4} />
          </div>
        </div>
      </div>
    </RouteSkeleton>
  );
}
