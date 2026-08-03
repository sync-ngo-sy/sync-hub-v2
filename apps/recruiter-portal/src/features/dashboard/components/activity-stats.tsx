import { StatCardSkeleton } from '@sync/ui/components/skeletons';
import { StatCard } from '@sync/ui/components/stat-card';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { problemMessage } from '@/lib/api-problem';
import type { ApplicationsRead, Count, JobsRead } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';

const UNKNOWN = '—';
const GRID = 'grid gap-5 sm:grid-cols-2 xl:grid-cols-4';

/** A count read off first pages says so with a `+`: the tenant's real total is this or more. */
function figure(count: Count | undefined): string {
  if (!count) return UNKNOWN;
  return count.atLeast ? `${count.value}+` : String(count.value);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Says what the counts were read from, because without the analytics endpoints they are read
 * from first pages rather than from the whole Tenant. */
function basis(jobs: JobsRead, applications: ApplicationsRead): string {
  if (jobs.toCount.length === 0) {
    return 'Nothing to count yet — publish a Job and these fill in as candidates apply.';
  }

  const jobsRead =
    jobs.toCount.length === jobs.open.value && !jobs.open.atLeast
      ? `all ${plural(jobs.toCount.length, 'published Job', 'published Jobs')}`
      : `your ${plural(jobs.toCount.length, 'newest published Job', 'newest published Jobs')}`;

  return `Counted from the ${plural(applications.counted, 'newest Application', 'newest Applications')} on ${jobsRead}. Tenant-wide totals arrive when the analytics endpoints ship.`;
}

interface ActivityStatsProps {
  jobs: PanelRead<JobsRead>;
  applications: PanelRead<ApplicationsRead>;
}

export function ActivityStats({ jobs, applications }: ActivityStatsProps) {
  if (jobs.isPending || applications.isPending) {
    return (
      <div className={GRID} role="status" aria-label="Loading the counts">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const refusal = jobs.error ?? applications.error;
  const counts = applications.data;

  return (
    <section aria-label="Hiring at a glance" className="space-y-3">
      {refusal ? (
        <RetryNotice
          message={problemMessage(refusal, "Couldn't count what your Jobs have brought in.")}
          onRetry={jobs.error ? jobs.refetch : applications.refetch}
        />
      ) : null}

      <div className={GRID}>
        <StatCard
          label="Open jobs"
          value={figure(jobs.data?.open)}
          trend={{
            label: jobs.data
              ? jobs.data.draft === 0
                ? 'Nothing in draft'
                : `${plural(jobs.data.draft, 'Job', 'Jobs')} in draft`
              : 'Draft count unread',
          }}
        />
        <StatCard
          label="Applications this week"
          value={figure(counts?.thisWeek)}
          trend={{
            label: counts
              ? counts.today === 0
                ? 'None in the last day'
                : `${counts.today} arrived in the last day`
              : 'Not counted',
            tone: counts && counts.today > 0 ? 'positive' : 'neutral',
          }}
        />
        <StatCard
          label="Awaiting review"
          value={figure(counts?.awaitingReview)}
          trend={{
            label: counts
              ? counts.awaitingReview.value === 0
                ? 'Nothing waiting'
                : 'Needs attention'
              : 'Not counted',
            tone: counts && counts.awaitingReview.value > 0 ? 'caution' : 'neutral',
          }}
        />
        <StatCard
          label="Qualified by screening"
          value={figure(counts?.qualified)}
          trend={{
            label:
              counts?.passRate === null || counts?.passRate === undefined
                ? 'No verdict decided yet'
                : `${counts.passRate}% pass rate`,
          }}
        />
      </div>

      {jobs.data && counts ? (
        <p className="text-meta text-muted-foreground">{basis(jobs.data, counts)}</p>
      ) : null}
    </section>
  );
}
