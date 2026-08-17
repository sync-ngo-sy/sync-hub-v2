import { TenantLogo } from '@sync/ui/components/tenant-logo';
import { Link } from '@tanstack/react-router';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { type JobSummary, jobMeta } from '../job';

export function JobList({ jobs }: { jobs: JobSummary[] }) {
  return (
    <ul aria-label="Jobs" className="divide-y divide-border border-t border-border">
      {jobs.map((job) => (
        <li key={job.id}>
          <JobRow job={job} />
        </li>
      ))}
    </ul>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      preload={false}
      className="group flex items-center gap-4 py-5"
    >
      <TenantLogo name={job.tenant.name} logoUrl={job.tenant.logo_url} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-title text-foreground group-hover:text-accent-foreground">
          {job.title}
        </span>
        <span className="text-meta text-muted-foreground">{jobMeta(job)}</span>
      </span>
      <time
        dateTime={job.created_at}
        title={absoluteDateTime(job.created_at)}
        className="shrink-0 text-meta text-muted-foreground"
      >
        {relativeTime(job.created_at)}
      </time>
    </Link>
  );
}
