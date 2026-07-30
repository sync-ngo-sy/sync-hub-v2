import type { components } from '@sync/api-client/schema';
import { EmptyState } from '@sync/ui/components/empty-state';
import { Button } from '@sync/ui/components/ui/button';
import { Skeleton } from '@sync/ui/components/ui/skeleton';
import { Link } from '@tanstack/react-router';
import { AlertCircle, Briefcase } from 'lucide-react';
import { useLatestJobs } from '../hooks/use-latest-jobs';
import { formatPosted } from '../relative-time';
import { WRAP } from '../wrap';

type JobSummary = components['schemas']['PublicJobSummary'];

function metaLine(job: JobSummary): string {
  return [job.tenant.name, job.location, job.employment_type].filter(Boolean).join(' · ');
}

function JobRow({ job }: { job: JobSummary }) {
  const posted = formatPosted(job.created_at);
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border py-6"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[17px] font-semibold text-foreground group-hover:text-accent-foreground">
          {job.title}
        </span>
        <span className="text-sm text-muted-foreground">{metaLine(job)}</span>
      </span>
      {posted.relative ? (
        <span
          className="ml-auto shrink-0 text-[13px] text-muted-foreground"
          title={posted.absolute}
        >
          {posted.relative}
        </span>
      ) : null}
    </Link>
  );
}

function IndexSkeleton() {
  return (
    <div role="status" aria-label="Loading open roles" className="border-t border-border">
      {[0, 1, 2, 3, 4].map((row) => (
        <div
          key={row}
          className="flex items-center justify-between gap-6 border-b border-border py-6"
        >
          <div className="flex w-full max-w-md flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

function IndexError({ onRetry, pending }: { onRetry: () => void; pending: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-6 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle aria-hidden className="size-4" />
        Couldn't load open roles
      </span>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={pending}>
        Retry
      </Button>
    </div>
  );
}

function JobsIndexBody() {
  const { data, isPending, isError, isFetching, refetch } = useLatestJobs();

  if (isPending) return <IndexSkeleton />;
  if (isError) return <IndexError onRetry={() => void refetch()} pending={isFetching} />;

  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase />}
        title="No open roles right now"
        description="New roles are posted daily — check back soon."
      />
    );
  }

  return (
    <div className="border-t border-border">
      {data.items.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
      <Link
        to="/jobs"
        className="flex items-center gap-2.5 border-b border-border py-6 text-[17px] font-semibold text-accent-foreground"
      >
        Browse all jobs <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

export function JobsIndex() {
  return (
    <section id="openings" className="py-[clamp(3.5rem,8vw,6rem)]">
      <div className={WRAP}>
        <div className="mb-10">
          <h2 className="mb-2.5 text-h2">Open roles</h2>
          <p className="max-w-[60ch] text-muted-foreground">
            Updated daily, from employers we've verified ourselves.
          </p>
        </div>
        <JobsIndexBody />
      </div>
    </section>
  );
}
