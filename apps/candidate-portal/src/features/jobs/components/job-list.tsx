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
      // Reading a Job counts a view, and a hover is not a read: preloading here would bill
      // every row a passing cursor crossed to the employer's view count.
      preload={false}
      className="group flex items-center justify-between gap-6 py-5"
    >
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
