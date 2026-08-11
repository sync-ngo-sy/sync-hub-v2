import type { DataTableColumn } from '@sync/ui/components/data-table';
import { StatusMark } from '@sync/ui/components/status-mark';
import { CandidateIdentity } from '@/features/candidates/components/candidate-cells';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import {
  type ApplicationSummary,
  candidateIdentity,
  pipelineState,
  screeningState,
} from '../application';

export function applicationColumns<TRow extends ApplicationSummary>(
  job?: DataTableColumn<TRow>,
): DataTableColumn<TRow>[] {
  const candidate: DataTableColumn<TRow> = {
    accessorKey: 'candidate_name',
    header: 'Candidate',
    meta: job ? { width: '30ch' } : { share: 1 },
    cell: ({ row }) => <CandidateIdentity {...candidateIdentity(row.original)} />,
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
    meta: { sort: { ascending: 'oldest', descending: 'newest' } },
    cell: ({ row }) => (
      <time dateTime={row.original.applied_at} title={absoluteDateTime(row.original.applied_at)}>
        {relativeTime(row.original.applied_at)}
      </time>
    ),
  };

  return [candidate, ...(job ? [job] : []), screening, pipeline, received];
}
