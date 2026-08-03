import { StatCardSkeleton } from '@sync/ui/components/skeletons';
import { StatCard } from '@sync/ui/components/stat-card';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { problemMessage } from '@/lib/api-problem';
import { type ApplicationsRead, figure, type JobsRead } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';

const GRID = 'grid gap-5 sm:grid-cols-2 xl:grid-cols-4';
const SKELETON_KEYS = ['open', 'week', 'waiting', 'qualified'];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

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
  const refusal = jobs.error ?? applications.error;

  if (!refusal && (jobs.isPending || applications.isPending)) {
    return (
      <div className={GRID} role="status" aria-label="Loading the counts">
        {SKELETON_KEYS.map((key) => (
          <StatCardSkeleton key={key} />
        ))}
      </div>
    );
  }

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
          trend={
            jobs.data && {
              label:
                jobs.data.draft.value === 0
                  ? 'Nothing in draft'
                  : `${figure(jobs.data.draft)} ${jobs.data.draft.value === 1 && !jobs.data.draft.atLeast ? 'Job' : 'Jobs'} in draft`,
            }
          }
        />
        <StatCard
          label="Applications this week"
          value={figure(counts?.thisWeek)}
          trend={
            counts && {
              label:
                counts.today.value === 0
                  ? 'None in the last day'
                  : `${figure(counts.today)} arrived in the last day`,
              tone: counts.today.value > 0 ? 'positive' : 'neutral',
            }
          }
        />
        <StatCard
          label="Awaiting review"
          value={figure(counts?.awaitingReview)}
          trend={
            counts && {
              label: counts.awaitingReview.value === 0 ? 'Nothing waiting' : 'Needs attention',
              tone: counts.awaitingReview.value > 0 ? 'caution' : 'neutral',
            }
          }
        />
        <StatCard
          label="Qualified by screening"
          value={figure(counts?.qualified)}
          trend={
            counts && {
              label:
                counts.passRate === null
                  ? 'No verdict decided yet'
                  : `${counts.passRate}% pass rate`,
            }
          }
        />
      </div>

      {jobs.data && counts ? (
        <p className="text-meta text-muted-foreground">{basis(jobs.data, counts)}</p>
      ) : null}
    </section>
  );
}
