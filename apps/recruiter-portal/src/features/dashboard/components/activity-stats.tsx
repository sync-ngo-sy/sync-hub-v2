import { StatBand, StatBandSkeleton } from '@sync/ui/components/stat-band';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { problemMessage } from '@/lib/api-problem';
import {
  awaitingReview,
  openedThisWeek,
  passRate,
  type TenantStats,
  weekOnWeek,
} from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';

const SKELETON_LABELS = ['Open jobs', 'Applications this week', 'Awaiting review', 'Qualified'];

function orDash(value: number | undefined): string {
  return value === undefined ? '—' : String(value);
}

export function ActivityStats({ stats }: { stats: PanelRead<TenantStats> }) {
  if (!stats.error && stats.isPending) {
    return (
      <div role="status" aria-label="Loading the counts">
        <StatBandSkeleton labels={SKELETON_LABELS} />
      </div>
    );
  }

  const counted = stats.data;

  return (
    <section aria-label="Hiring at a glance" className="space-y-3">
      {stats.error ? (
        <RetryNotice
          message={problemMessage(stats.error, "Couldn't count what your Jobs have brought in.")}
          onRetry={stats.refetch}
        />
      ) : null}

      <StatBand
        items={[
          {
            label: 'Open jobs',
            value: orDash(counted?.jobs.published),
            trend: counted ? openedThisWeek(counted.jobs.published_last_week) : undefined,
          },
          {
            label: 'Applications this week',
            value: orDash(counted?.applications.last_7d),
            trend: counted
              ? weekOnWeek(counted.applications.last_7d, counted.applications.previous_7d)
              : undefined,
          },
          {
            label: 'Awaiting review',
            value: orDash(counted?.applications.by_stage.new),
            trend: counted ? awaitingReview(counted.applications.by_stage.new) : undefined,
          },
          {
            label: 'Qualified by screening',
            value: orDash(counted?.applications.by_qualification.qualified),
            trend: counted ? passRate(counted.applications.pass_rate) : undefined,
          },
        ]}
      />
    </section>
  );
}
