import { EmptyState } from '@sync/ui/components/empty-state';
import { SkeletonText } from '@sync/ui/components/skeletons';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { ChartSpline } from 'lucide-react';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { conversionLabel, viewsLabel } from '@/features/tracked-links/tracked-link';
import { problemMessage } from '@/lib/api-problem';
import { applicants, type Source, sourcesSubtitle, type TenantStats } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';
import { DashboardPanel } from './dashboard-panel';

function SourcesList({ sources }: { sources: Source[] }) {
  return (
    <ul aria-label="Views and applications by source" className="divide-y divide-border">
      {sources.map((source) => (
        <li
          key={source.name}
          className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-meta text-secondary-foreground">{source.name}</span>
            <span className="truncate text-meta font-mono tabular-nums text-muted-foreground">
              {`${viewsLabel(source.views)} · ${applicants(source.applications)}`}
            </span>
          </span>
          <span className="shrink-0 text-meta font-mono tabular-nums text-foreground">
            {conversionLabel(source.conversion_rate)}
          </span>
        </li>
      ))}
    </ul>
  );
}

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

      {sources.length > 0 ? <SourcesList sources={sources} /> : null}
    </DashboardPanel>
  );
}
