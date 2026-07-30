import { Card, CardContent, CardHeader } from '@sync/ui/components/ui/card';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cn } from '@sync/ui/lib/utils';
import { StatCardShell } from './stat-card';

/** Placeholder for a block of prose; the last line is shortened like real text. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const keys = Array.from({ length: lines }, (_, index) => `line-${index}`);
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {keys.map((key, index) => (
        <Skeleton key={key} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Matches the StatCard layout — via its shared shell — while the figure loads. */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <StatCardShell className={className} aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-20" />
    </StatCardShell>
  );
}

/** Matches a titled content card (header + body) while its contents load. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className} aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <SkeletonText lines={3} />
      </CardContent>
    </Card>
  );
}
