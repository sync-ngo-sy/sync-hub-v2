import { Card, CardContent, CardHeader } from '@sync/ui/components/ui/card';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cn } from '@sync/ui/lib/utils';
import type { ReactNode } from 'react';
import { ChartCardShell } from './chart-card';
import { PageHeaderShell } from './page-header';
import { StatCardShell } from './stat-card';

export function placeholderKeys(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

function columnTracks(columns: number) {
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
}

export function RouteSkeleton({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div data-slot="route-skeleton" role="status" aria-label={label} className={className}>
      {children}
    </div>
  );
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

export function PageHeaderSkeleton({
  action = false,
  className,
}: {
  action?: boolean;
  className?: string;
}) {
  return (
    <PageHeaderShell
      className={className}
      aria-hidden="true"
      actions={action ? <Skeleton className="h-8 w-28" /> : undefined}
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

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card className={className} aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <SkeletonText lines={lines} />
      </CardContent>
    </Card>
  );
}

export function CenteredNoticeSkeleton({ action = false }: { action?: boolean }) {
  return (
    <>
      <Skeleton className="mx-auto h-7 w-64" aria-hidden="true" />
      <SkeletonText lines={2} />
      {action ? <Skeleton className="mx-auto h-10 w-36" aria-hidden="true" /> : null}
    </>
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

export function TableSkeleton({
  columns,
  rows = 5,
  className,
}: {
  columns: number;
  rows?: number;
  className?: string;
}) {
  const cells = placeholderKeys(columns, 'cell');

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card shadow-card',
        className,
      )}
      aria-hidden="true"
    >
      <div
        className="grid gap-4 border-b border-border bg-table-header px-(--space-card) py-3"
        style={columnTracks(columns)}
      >
        {cells.map((key) => (
          <Skeleton key={key} className="h-3 w-20" />
        ))}
      </div>
      {placeholderKeys(rows, 'row').map((row) => (
        <div
          key={row}
          className="grid gap-4 border-b border-border px-(--space-card) py-4 last:border-b-0"
          style={columnTracks(columns)}
        >
          {cells.map((key) => (
            <Skeleton key={`${row}-${key}`} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TabStripSkeleton({ tabs, className }: { tabs: number; className?: string }) {
  return (
    <div className={cn('flex h-10 items-center gap-7', className)} aria-hidden="true">
      {placeholderKeys(tabs, 'tab').map((key) => (
        <Skeleton key={key} className="h-4 w-20" />
      ))}
    </div>
  );
}

export function ToolbarSkeleton({
  controls = 0,
  className,
}: {
  controls?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
      aria-hidden="true"
    >
      <Skeleton className="h-9 w-full max-w-xs" />
      {controls > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {placeholderKeys(controls, 'control').map((key) => (
            <Skeleton key={key} className="h-9 w-36" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FactGridSkeleton({ facts, className }: { facts: number; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-px overflow-hidden rounded-lg border border-border bg-border',
        className,
      )}
      aria-hidden="true"
    >
      {placeholderKeys(facts, 'fact').map((key) => (
        <div key={key} className="space-y-2 bg-card px-3 py-2.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({
  fields = 3,
  submit = true,
  className,
}: {
  fields?: number;
  submit?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)} aria-hidden="true">
      {placeholderKeys(fields, 'field').map((key) => (
        <div key={key} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      {submit ? <Skeleton className="h-10 w-full" /> : null}
    </div>
  );
}
