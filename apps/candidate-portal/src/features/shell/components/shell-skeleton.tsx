import { RouteSkeleton } from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cn } from '@sync/ui/lib/utils';
import { MEASURE } from '../measure';
import { DESTINATIONS } from '../nav';
import { PublicShell } from './public-shell';

export function AccountShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="border-b border-border" aria-hidden="true">
        <div
          className={cn('mx-auto flex w-full items-center gap-3 px-(--space-gutter) py-3', MEASURE)}
        >
          <Skeleton className="h-6 w-24" />
          <div className="ml-2 hidden items-center gap-2 md:flex">
            {DESTINATIONS.map(({ to }) => (
              <Skeleton key={to} className="h-8 w-24" />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </div>

      <main
        className={cn(
          'mx-auto w-full flex-1 px-(--space-gutter) pt-(--space-section) pb-24 md:pb-16',
          MEASURE,
        )}
      >
        <RouteSkeleton label="Loading your account" />
      </main>
    </div>
  );
}

export function BrowseShellSkeleton() {
  return (
    <PublicShell>
      <RouteSkeleton label="Loading Sync Hub" />
    </PublicShell>
  );
}
