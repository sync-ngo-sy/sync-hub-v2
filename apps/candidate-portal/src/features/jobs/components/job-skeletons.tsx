import { SkeletonText } from '@sync/ui/components/skeletons';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { Skeleton } from '@sync/ui/components/ui/skeleton';

function JobCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardContent className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

export function JobListSkeleton() {
  const keys = ['a', 'b', 'c', 'd', 'e'];
  return (
    <ul className="space-y-3" aria-hidden="true">
      {keys.map((key) => (
        <li key={key}>
          <JobCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function JobDetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-9 w-32" />
      <SkeletonText lines={6} />
    </div>
  );
}
