import type { DataTableColumn } from '@sync/ui/components/data-table';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Link } from '@tanstack/react-router';
import type { ApplicationJob } from '@/features/applications/application';
import { jobPlace } from '../job';

export function jobColumn<TRow extends { job: ApplicationJob }>(): DataTableColumn<TRow> {
  return {
    id: 'job',
    header: 'Job',
    meta: { share: 1 },
    cell: ({ row }) => (
      <Link
        to="/jobs/$jobId"
        params={{ jobId: row.original.job.id }}
        search={{}}
        onClick={(event) => event.stopPropagation()}
        className="flex min-w-0 flex-col gap-1 rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <TruncatedText className="font-medium">{row.original.job.title}</TruncatedText>
        <JobPlace job={row.original.job} />
      </Link>
    ),
  };
}

function JobPlace({ job }: { job: ApplicationJob }) {
  const place = jobPlace(job);
  if (place === null) return null;

  return <TruncatedText className="text-meta text-muted-foreground">{place}</TruncatedText>;
}
