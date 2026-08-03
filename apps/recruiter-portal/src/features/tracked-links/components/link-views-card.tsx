import { ChartCard } from '@sync/ui/components/chart-card';
import { SkeletonText } from '@sync/ui/components/skeletons';
import { lazy, Suspense } from 'react';
import { type TrackedLink, totalViews, viewsPerLink } from '../tracked-link';

const LinkViewsChart = lazy(() => import('./link-views-chart'));

export function LinkViewsCard({ links }: { links: TrackedLink[] }) {
  const bars = viewsPerLink(links);

  return (
    <ChartCard
      title="Where applicants find you"
      description="Job views each link has brought since it was minted, turned off ones included."
    >
      {totalViews(links) === 0 ? (
        <p className="text-dense text-muted-foreground">
          No views yet — the counts fill in as candidates open this Job through these links.
        </p>
      ) : (
        <Suspense fallback={<SkeletonText lines={4} />}>
          <LinkViewsChart bars={bars} />
        </Suspense>
      )}
    </ChartCard>
  );
}
