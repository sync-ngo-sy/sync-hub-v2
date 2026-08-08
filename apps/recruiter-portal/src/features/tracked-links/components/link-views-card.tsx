import { ChartCard } from '@sync/ui/components/chart-card';
import { SkeletonText } from '@sync/ui/components/skeletons';
import { lazy, Suspense } from 'react';
import { type TrackedLink, viewsPerSource } from '../tracked-link';

const LinkViewsChart = lazy(() => import('./link-views-chart'));

export function LinkViewsCard({ links, jobViews }: { links: TrackedLink[]; jobViews: number }) {
  const bars = viewsPerSource(links, jobViews);

  return (
    <ChartCard
      title="Views by source"
      description="Job views each link has brought since it was minted, turned off ones included. Direct is everyone who arrived without a link."
    >
      {jobViews === 0 ? (
        <p className="text-dense text-muted-foreground">
          No views yet — the counts fill in as candidates open this Job.
        </p>
      ) : (
        <Suspense fallback={<SkeletonText lines={4} />}>
          <LinkViewsChart bars={bars} />
        </Suspense>
      )}
    </ChartCard>
  );
}
