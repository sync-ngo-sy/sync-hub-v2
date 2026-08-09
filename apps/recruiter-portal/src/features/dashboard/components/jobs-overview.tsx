import { EmptyState } from '@sync/ui/components/empty-state';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { StatusMark } from '@sync/ui/components/status-mark';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { BriefcaseBusiness } from 'lucide-react';
import { type JobSummary, jobMeta, jobState } from '@/features/jobs/job';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { applicants } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';
import { DashboardPanel } from './dashboard-panel';

interface JobsOverviewProps {
  jobs: PanelRead<JobSummary[]>;
  onJobOpen: (job: JobSummary) => void;
  onCreateJob: () => void;
}

export function JobsOverview({ jobs, onJobOpen, onCreateJob }: JobsOverviewProps) {
  const overview = jobs.data ?? [];

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
        <ul className="-mx-(--card-spacing) divide-y divide-border">
          {overview.map((job) => {
            const state = jobState(job.status);
            return (
              <li key={job.id}>
                <button
                  type="button"
                  aria-label={`Open ${job.title}`}
                  onClick={() => onJobOpen(job)}
                  className="flex w-full cursor-pointer items-start justify-between gap-3 px-(--card-spacing) py-3 text-start outline-none transition-colors hover:bg-interactive-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium text-dense text-foreground">{job.title}</span>
                    <span className="text-meta text-muted-foreground">{jobMeta(job)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusMark label={state.label} tone={state.tone} />
                    {job.application_count > 0 ? (
                      <span className="text-meta tabular-nums text-muted-foreground">
                        {applicants(job.application_count)}
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
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </DashboardPanel>
  );
}
