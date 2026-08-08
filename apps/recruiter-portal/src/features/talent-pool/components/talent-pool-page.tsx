import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { candidateMeta, pooledCard } from '@/features/candidates/candidate';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useSavedCandidates } from '../hooks/use-talent-pool';
import type { PooledCandidate } from '../pool';
import { DropCandidateDialog } from './drop-candidate-dialog';

const DESCRIPTION =
  'People your team wants to reach again, whether or not they have ever applied. The most recently saved come first.';

const TO_SEARCH = (
  <Link to="/candidates" search={{}} className={buttonVariants({ variant: 'outline' })}>
    Search for candidates
  </Link>
);

const COLUMNS: DataTableColumn<PooledCandidate>[] = [
  {
    accessorKey: 'full_name',
    header: 'Candidate',
    cell: ({ row }) => {
      const meta = candidateMeta(pooledCard(row.original));
      return (
        <span className="flex min-w-52 flex-col gap-1">
          <span>{row.original.full_name}</span>
          {meta ? (
            <span className="text-meta font-normal text-muted-foreground">{meta}</span>
          ) : null}
        </span>
      );
    },
  },
  {
    accessorKey: 'added_at',
    header: 'Saved',
    cell: ({ row }) => (
      <time dateTime={row.original.added_at} title={absoluteDateTime(row.original.added_at)}>
        {relativeTime(row.original.added_at)}
      </time>
    ),
  },
];

interface TalentPoolPageProps {
  onCandidateOpen: (entry: PooledCandidate) => void;
}

export function TalentPoolPage({ onCandidateOpen }: TalentPoolPageProps) {
  const saved = useSavedCandidates();
  const [dropping, setDropping] = useState<PooledCandidate | null>(null);

  return (
    <div className="space-y-(--space-section)">
      <PageHeader title="Talent pool" description={DESCRIPTION} />

      <DataTable
        label="Saved Candidates"
        columns={COLUMNS}
        data={saved.data ?? []}
        getRowId={(entry) => entry.candidate_id}
        rowLabel={(entry) => entry.full_name}
        onRowOpen={onCandidateOpen}
        rowActions={(entry) => [
          { label: 'Drop from talent pool', onSelect: () => setDropping(entry) },
        ]}
        isLoading={saved.isPending}
        error={
          saved.isError
            ? {
                message: problemMessage(saved.error, "Couldn't read your talent pool."),
                onRetry: () => void saved.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Star,
          message:
            'Nobody saved yet — search reaches every Candidate on the platform who has opted into being found.',
          action: TO_SEARCH,
        }}
        loadMore={{
          hasMore: saved.hasNextPage,
          isLoading: saved.isFetchingNextPage,
          onLoadMore: () => void saved.fetchNextPage(),
        }}
      />

      {dropping ? <DropCandidateDialog entry={dropping} onClose={() => setDropping(null)} /> : null}
    </div>
  );
}
