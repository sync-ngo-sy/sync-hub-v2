import type { DataTableColumn } from '@sync/ui/components/data-table';
import { StatusMark } from '@sync/ui/components/status-mark';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import {
  type ApplicationSummary,
  candidateMeta,
  pipelineState,
  screeningState,
} from '../application';

export function applicationColumns<TRow extends ApplicationSummary>(
  job?: DataTableColumn<TRow>,
): DataTableColumn<TRow>[] {
  const candidate: DataTableColumn<TRow> = {
    accessorKey: 'candidate_name',
    header: 'Candidate',
    cell: ({ row }) => {
      const meta = candidateMeta(row.original);
      return (
        <span className="flex min-w-52 flex-col gap-1">
          <span>{row.original.candidate_name}</span>
          {meta ? (
            <span className="text-meta font-normal text-muted-foreground">{meta}</span>
          ) : null}
        </span>
      );
    },
  };

  const screening: DataTableColumn<TRow> = {
    accessorKey: 'qualification_status',
    header: 'Screening',
    cell: ({ row }) => {
      const state = screeningState(row.original.qualification_status);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
  };

  const pipeline: DataTableColumn<TRow> = {
    accessorKey: 'status',
    header: 'Pipeline',
    cell: ({ row }) => {
      const state = pipelineState(row.original.status);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
  };

  const received: DataTableColumn<TRow> = {
    accessorKey: 'applied_at',
    header: 'Received',
    cell: ({ row }) => (
      <time dateTime={row.original.applied_at} title={absoluteDateTime(row.original.applied_at)}>
        {relativeTime(row.original.applied_at)}
      </time>
    ),
  };

  return [candidate, ...(job ? [job] : []), screening, pipeline, received];
}
