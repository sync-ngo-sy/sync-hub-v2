import { RouteSkeleton, SkeletonText } from '@sync/ui/components/skeletons';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { LandingHeader } from './landing-header';
import { Wrap } from './page-parts';

export function LandingSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingHeader />
      <main className="flex-1">
        <section className="pt-[clamp(3.5rem,8vw,6.5rem)] pb-[clamp(3rem,6vw,5rem)]">
          <Wrap>
            <RouteSkeleton label="Loading Sync Hub" className="space-y-6">
              <Skeleton className="h-4 w-56" aria-hidden="true" />
              <div className="max-w-[42rem] space-y-4" aria-hidden="true">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-3/4" />
              </div>
              <div className="max-w-[34rem]">
                <SkeletonText lines={3} />
              </div>
              <Skeleton className="h-11 w-44" aria-hidden="true" />
            </RouteSkeleton>
          </Wrap>
        </section>
      </main>
    </div>
  );
}
