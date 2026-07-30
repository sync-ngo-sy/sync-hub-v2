import type { components } from '@sync/api-client/schema';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { Link } from '@tanstack/react-router';
import { Briefcase, MapPin } from 'lucide-react';
import { formatAbsoluteDate, formatRelativeDate, humanizeEmploymentType } from '../lib/format';

type JobSummary = components['schemas']['PublicJobSummary'];

export function JobSummaryCard({ job }: { job: JobSummary }) {
  return (
    <Card className="relative transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
      <CardContent className="space-y-2">
        <h2 className="font-heading text-base font-medium text-foreground">
          <Link
            to="/jobs/$jobId"
            params={{ jobId: job.id }}
            className="outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {job.title}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">{job.tenant.name}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {job.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="size-3.5" />
              {job.location}
            </span>
          ) : null}
          {job.employment_type ? (
            <span className="inline-flex items-center gap-1">
              <Briefcase aria-hidden className="size-3.5" />
              {humanizeEmploymentType(job.employment_type)}
            </span>
          ) : null}
          <time
            dateTime={job.created_at}
            title={formatAbsoluteDate(job.created_at)}
            className="ml-auto"
          >
            {formatRelativeDate(job.created_at)}
          </time>
        </div>
      </CardContent>
    </Card>
  );
}
