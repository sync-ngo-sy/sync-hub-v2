import { EmptyState } from '@sync/ui/components/empty-state';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { StatusChip } from '@sync/ui/components/status-chip';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { BriefcaseBusiness } from 'lucide-react';
import { type JobSummary, jobMeta, jobState } from '@/features/jobs/job';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { type Count, figure, type JobsRead } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';
import { DashboardPanel } from './dashboard-panel';

function applicants(count: Count): string {
  return count.value === 1 && !count.atLeast ? '1 application' : `${figure(count)} applications`;
}

interface JobsOverviewProps {
  jobs: PanelRead<JobsRead>;
  applicationsByJob?: Record<string, Count>;
  onJobOpen: (job: JobSummary) => void;
  onCreateJob: () => void;
}

export function JobsOverview({
  jobs,
  applicationsByJob,
  onJobOpen,
  onCreateJob,
}: JobsOverviewProps) {
  const overview = jobs.data?.overview ?? [];

  return (
    <DashboardPanel
      title="Your jobs"
      description="The newest roles your Tenant has written, whatever state each one is in."
      action={
        <Link to="/jobs" className={buttonVariants({ variant: 'link', size: 'sm' })}>
          All Jobs
        </Link>
      }
    >
      {jobs.isPending ? (
        <div role="status" aria-label="Loading your jobs">
          <ListSkeleton rows={4} />
        </div>
      ) : null}

      {jobs.error ? (
        <RetryNotice
          message={problemMessage(jobs.error, "Couldn't load your Jobs.")}
          onRetry={jobs.refetch}
        />
      ) : null}

      {!jobs.isPending && !jobs.error && overview.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          message="No Jobs yet — write the first role your Tenant is hiring for."
          action={<Button onClick={onCreateJob}>Create your first job</Button>}
        />
      ) : null}

      {overview.length > 0 ? (
        <ul className="divide-y divide-border">
          {overview.map((job) => {
            const state = jobState(job.status);
            const counted = applicationsByJob?.[job.id];
            return (
              <li key={job.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                <span className="flex min-w-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Open ${job.title}`}
                    onClick={() => onJobOpen(job)}
                    className="rounded-sm text-start font-medium text-dense text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {job.title}
                  </button>
                  <span className="text-meta text-muted-foreground">{jobMeta(job)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusChip label={state.label} tone={state.tone} />
                  {counted ? (
                    <span className="text-meta tabular-nums text-muted-foreground">
                      {applicants(counted)}
                    </span>
                  ) : (
                    <time
                      dateTime={job.updated_at}
                      title={absoluteDateTime(job.updated_at)}
                      className="text-meta text-muted-foreground"
                    >
                      {`Updated ${relativeTime(job.updated_at)}`}
                    </time>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </DashboardPanel>
  );
}
