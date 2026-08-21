import { RouteSkeleton } from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { DESTINATIONS } from '../nav';

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div
        className="sticky top-0 hidden h-dvh space-y-6 border-r border-sidebar-border p-4 lg:block"
        aria-hidden="true"
      >
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {DESTINATIONS.map(({ to }) => (
            <Skeleton key={to} className="h-8 w-full" />
          ))}
        </div>
      </div>

      <div
        className="flex items-center gap-3 border-b border-border px-(--space-gutter) py-3 lg:hidden"
        aria-hidden="true"
      >
        <Skeleton className="size-9" />
        <Skeleton className="h-6 w-40" />
      </div>

      <main className="mx-auto min-w-0 w-full max-w-(--measure-workspace) px-(--space-gutter) py-(--space-section) lg:pb-16">
        <RouteSkeleton label="Loading the Platform" />
      </main>
    </div>
  );
}
