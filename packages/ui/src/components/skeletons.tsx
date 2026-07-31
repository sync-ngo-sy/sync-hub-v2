import { CardContent, CardHeader } from '@sync/ui/components/ui/card';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cn } from '@sync/ui/lib/utils';
import { ChartCardShell } from './chart-card';
import { PageHeaderShell } from './page-header';
import { StatCardShell } from './stat-card';

// Each skeleton reuses the shell of the molecule it stands in for, and is hidden from
// assistive technology: the surface that swaps it for real content owns announcing that.

export function placeholderKeys(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {placeholderKeys(lines, 'line').map((key, index) => (
        <Skeleton key={key} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <PageHeaderShell
      className={className}
      aria-hidden="true"
      actions={<Skeleton className="h-8 w-28" />}
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-32" />
    </PageHeaderShell>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <StatCardShell className={className} aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-20" />
    </StatCardShell>
  );
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <ChartCardShell className={className} aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <SkeletonText lines={3} />
      </CardContent>
    </ChartCardShell>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn('divide-y divide-border border-t border-border', className)}
      aria-hidden="true"
    >
      {placeholderKeys(rows, 'row').map((key) => (
        <div key={key} className="flex items-center justify-between gap-6 py-5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
