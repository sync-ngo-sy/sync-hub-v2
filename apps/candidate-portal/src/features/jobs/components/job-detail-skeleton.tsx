import { RouteSkeleton, SkeletonText } from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';

export function JobDetailSkeleton() {
  return (
    <RouteSkeleton label="Loading this role" className="space-y-10">
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-7 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-5 w-32" />
        <SkeletonText lines={4} />
      </div>
    </RouteSkeleton>
  );
}
