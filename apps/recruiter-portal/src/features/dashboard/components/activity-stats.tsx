import { StatCardSkeleton } from '@sync/ui/components/skeletons';
import { StatCard } from '@sync/ui/components/stat-card';
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

const GRID = 'grid gap-5 sm:grid-cols-2 xl:grid-cols-4';
const SKELETON_KEYS = ['open', 'week', 'waiting', 'qualified'];

function figure(value: number | undefined): string {
  return value === undefined ? '—' : String(value);
}

export function ActivityStats({ stats }: { stats: PanelRead<TenantStats> }) {
  if (!stats.error && stats.isPending) {
    return (
      <div className={GRID} role="status" aria-label="Loading the counts">
        {SKELETON_KEYS.map((key) => (
          <StatCardSkeleton key={key} />
        ))}
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

      <div className={GRID}>
        <StatCard
          label="Open jobs"
          value={figure(counted?.jobs.published)}
          trend={counted && openedThisWeek(counted.jobs.published_last_week)}
        />
        <StatCard
          label="Applications this week"
          value={figure(counted?.applications.last_7d)}
          trend={
            counted && weekOnWeek(counted.applications.last_7d, counted.applications.previous_7d)
          }
        />
        <StatCard
          label="Awaiting review"
          value={figure(counted?.applications.by_stage.new)}
          trend={counted && awaitingReview(counted.applications.by_stage.new)}
        />
        <StatCard
          label="Qualified by screening"
          value={figure(counted?.applications.by_qualification.qualified)}
          trend={counted && passRate(counted.applications.pass_rate)}
        />
      </div>
    </section>
  );
}
