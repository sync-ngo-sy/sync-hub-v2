import { RouteSkeleton, SkeletonText } from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { Wrap } from './editorial';
import { LandingHeader } from './landing-header';

export function LandingSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingHeader />
      <main className="flex-1">
        <section className="pt-[clamp(3.5rem,9vw,8rem)] pb-[clamp(3rem,7vw,6rem)]">
          <Wrap>
            <RouteSkeleton label="Loading Sync Hub" className="space-y-6">
              <Skeleton className="h-4 w-64" aria-hidden="true" />
              <div className="space-y-4" aria-hidden="true">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-4/5" />
              </div>
              <div className="border-t border-border pt-6 sm:ml-auto sm:max-w-[380px]">
                <SkeletonText lines={3} />
                <Skeleton className="mt-7 h-11 w-40" aria-hidden="true" />
              </div>
            </RouteSkeleton>
          </Wrap>
        </section>
      </main>
    </div>
  );
}
