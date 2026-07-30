import { CardSkeleton, SkeletonText } from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';

/** The Suspense fallback for a route chunk: the page's shape, never a spinner. */
export function PageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <SkeletonText lines={1} className="max-w-sm" />
      </div>
      <CardSkeleton />
    </div>
  );
}
