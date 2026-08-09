import { StatBand, StatBandSkeleton } from '@sync/ui/components/stat-band';
import { Link } from '@tanstack/react-router';
import { BriefcaseBusiness, CircleCheck, Clock3, Inbox } from 'lucide-react';
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

const OPEN_JOBS = <Link to="/jobs" search={{ status: 'published' }} />;

const THIS_WEEK = <Link to="/applications" search={{ received: '7d' }} />;

const AWAITING_REVIEW = <Link to="/applications" search={{ pipeline: ['new'] }} />;

const QUALIFIED_BY_SCREENING = <Link to="/applications" search={{ screening: ['qualified'] }} />;

function orDash(value: number | undefined): string {
  return value === undefined ? '—' : String(value);
}

export function ActivityStats({ stats }: { stats: PanelRead<TenantStats> }) {
  if (!stats.error && stats.isPending) {
    return (
      <div role="status" aria-label="Loading the counts">
        <StatBandSkeleton labels={SKELETON_LABELS} variant="cards" />
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
        variant="cards"
        items={[
          {
            label: 'Open jobs',
            value: orDash(counted?.jobs.published),
            icon: BriefcaseBusiness,
            trend: counted ? openedThisWeek(counted.jobs.published_last_week) : undefined,
            render: OPEN_JOBS,
          },
          {
            label: 'Applications this week',
            value: orDash(counted?.applications.last_7d),
            icon: Inbox,
            trend: counted
              ? weekOnWeek(counted.applications.last_7d, counted.applications.previous_7d)
              : undefined,
            render: THIS_WEEK,
          },
          {
            label: 'Awaiting review',
            value: orDash(counted?.applications.by_stage.new),
            icon: Clock3,
            trend: counted ? awaitingReview(counted.applications.by_stage.new) : undefined,
            render: AWAITING_REVIEW,
          },
          {
            label: 'Qualified by screening',
            value: orDash(counted?.applications.by_qualification.qualified),
            icon: CircleCheck,
            trend: counted ? passRate(counted.applications.pass_rate) : undefined,
            render: QUALIFIED_BY_SCREENING,
          },
        ]}
      />
    </section>
  );
}
