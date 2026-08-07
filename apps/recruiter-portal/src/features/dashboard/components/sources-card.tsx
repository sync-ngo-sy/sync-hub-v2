import { EmptyState } from '@sync/ui/components/empty-state';
import { SkeletonText } from '@sync/ui/components/skeletons';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { ChartSpline } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { viewsRanked } from '@/features/tracked-links/tracked-link';
import { problemMessage } from '@/lib/api-problem';
import { sourcesSubtitle, type TenantStats } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';
import { DashboardPanel } from './dashboard-panel';

const LinkViewsChart = lazy(() => import('@/features/tracked-links/components/link-views-chart'));

export function SourcesCard({ stats }: { stats: PanelRead<TenantStats> }) {
  const sources = stats.data?.sources ?? [];

  return (
    <DashboardPanel
      title="Where applicants find you"
      description={sourcesSubtitle(stats.data)}
      action={
        <Link to="/tracked-links" className={buttonVariants({ variant: 'link', size: 'sm' })}>
          All links
        </Link>
      }
    >
      {stats.isPending && !stats.error ? (
        <div role="status" aria-label="Loading where applicants find you">
          <SkeletonText lines={4} />
        </div>
      ) : null}

      {stats.error ? (
        <RetryNotice
          message={problemMessage(stats.error, "Couldn't load where your applicants come from.")}
          onRetry={stats.refetch}
        />
      ) : null}

      {!stats.isPending && !stats.error && sources.length === 0 ? (
        <EmptyState
          icon={ChartSpline}
          message="No views yet — mint a tracked link on a Job and share it to see which channels bring people in."
          action={
            <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
              Go to Jobs
            </Link>
          }
        />
      ) : null}

      {sources.length > 0 ? (
        <Suspense fallback={<SkeletonText lines={4} />}>
          <LinkViewsChart
            bars={viewsRanked(
              sources.map((source) => ({
                id: source.name,
                name: source.name,
                views: source.views,
              })),
            )}
          />
        </Suspense>
      ) : null}
    </DashboardPanel>
  );
}
