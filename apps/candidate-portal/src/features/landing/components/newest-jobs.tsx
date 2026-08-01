import { EmptyState } from '@sync/ui/components/empty-state';
import { HERO_BUTTON } from '@sync/ui/components/landing';
import { placeholderKeys } from '@sync/ui/components/skeletons';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';
import { type JobSummary, jobMeta, NOTHING_PUBLISHED } from '@/features/jobs/job';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { NEWEST_JOBS_LIMIT, useNewestJobs } from '../hooks/use-newest-jobs';
import { INDEX_ROW, Wrap } from './editorial';

const TITLE = 'text-[1.0625rem] font-semibold';

const HEADING_ID = 'open-roles';

export function NewestJobs() {
  const jobs = useNewestJobs();

  return (
    <section aria-labelledby={HEADING_ID} className="py-[clamp(3.5rem,8vw,6rem)]">
      <Wrap>
        <div className="mb-10">
          <h2 id={HEADING_ID} className="font-heading text-h2 text-foreground">
            Open roles
          </h2>
          <p className="mt-2.5 max-w-[60ch] text-muted-foreground">
            Updated daily, from employers we've verified ourselves.
          </p>
        </div>

        {jobs.isPending ? <JobIndexSkeleton /> : null}
        {jobs.isError ? <JobIndexFailure onRetry={() => void jobs.refetch()} /> : null}
        {jobs.data ? <JobIndex jobs={jobs.data.items} /> : null}
      </Wrap>
    </section>
  );
}

function JobIndex({ jobs }: { jobs: JobSummary[] }) {
  if (jobs.length === 0) return <NothingPublished />;

  return (
    <>
      <ul aria-label="Newest roles" className="border-t border-border">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobRow job={job} />
          </li>
        ))}
      </ul>
      <Link to="/jobs" className={cn(INDEX_ROW, TITLE, 'gap-x-2.5 text-accent-foreground')}>
        Browse all jobs <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      // A hover is not a read, and reading a Job counts a view against the employer's numbers.
      preload={false}
      className={cn(INDEX_ROW, 'group justify-between')}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className={cn(TITLE, 'text-foreground group-hover:text-accent-foreground')}>
          {job.title}
        </span>
        <span className="text-dense text-muted-foreground">{jobMeta(job)}</span>
      </span>
      <time
        dateTime={job.created_at}
        title={absoluteDateTime(job.created_at)}
        className="ml-auto shrink-0 text-meta text-muted-foreground"
      >
        {relativeTime(job.created_at)}
      </time>
    </Link>
  );
}

function JobIndexSkeleton() {
  return (
    <div role="status" aria-label="Loading the newest roles" className="border-t border-border">
      {placeholderKeys(NEWEST_JOBS_LIMIT, 'job').map((key) => (
        <div key={key} className={cn(INDEX_ROW, 'justify-between')} aria-hidden="true">
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Kept in the index's own register: a card here would be the only one on the page. */
function JobIndexFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={cn(INDEX_ROW, 'items-center justify-between border-t')}>
      <p className="text-dense text-muted-foreground">Couldn't load the newest roles.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function NothingPublished() {
  return (
    <EmptyState
      icon={Briefcase}
      message={NOTHING_PUBLISHED}
      action={
        <Link to="/signup" className={cn(buttonVariants({ size: 'lg' }), HERO_BUTTON)}>
          Create your profile
        </Link>
      }
    />
  );
}
