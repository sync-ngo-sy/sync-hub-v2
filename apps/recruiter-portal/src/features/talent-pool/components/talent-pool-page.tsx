import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { pooledCard } from '@/features/candidates/candidate';
import {
  CandidateNameCell,
  NOTHING,
  yearsOf,
} from '@/features/candidates/components/candidate-cells';
import { TagList } from '@/features/crm/components/tag-list';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useSavedCandidates } from '../hooks/use-talent-pool';
import {
  NOBODY_SAVED,
  nobodyMatches,
  type PooledCandidate,
  type PoolReading,
  type TalentPoolOrder,
} from '../pool';
import { DropCandidateDialog } from './drop-candidate-dialog';
import { PoolSearch } from './pool-search';

const DESCRIPTION =
  'People your team wants to reach again, whether or not they have ever applied. Everything a row says about them is read live, except the day you saved them.';

const TO_SEARCH = (
  <Link to="/candidates" search={{}} className={buttonVariants({ variant: 'outline' })}>
    Search for candidates
  </Link>
);

const COLUMNS: DataTableColumn<PooledCandidate>[] = [
  {
    accessorKey: 'full_name',
    header: 'Candidate',
    meta: { sort: { ascending: 'name', descending: 'name_reversed' } },
    cell: ({ row }) => <CandidateNameCell card={pooledCard(row.original)} />,
  },
  {
    accessorKey: 'canonical_role_name',
    header: 'Role',
    cell: ({ row }) => row.original.canonical_role_name ?? NOTHING,
  },
  {
    accessorKey: 'total_experience_years',
    header: 'Experience',
    cell: ({ row }) => yearsOf(row.original.total_experience_years),
  },
  {
    accessorKey: 'location_name',
    header: 'Location',
    cell: ({ row }) => row.original.location_name ?? NOTHING,
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags = row.original.tags ?? [];
      if (tags.length === 0) return NOTHING;
      return (
        <TagList label={`Tags on ${row.original.full_name}`} names={tags.map((tag) => tag.name)} />
      );
    },
  },
  {
    accessorKey: 'added_at',
    header: 'Saved',
    meta: { sort: { ascending: 'oldest', descending: 'newest' } },
    cell: ({ row }) => (
      <time dateTime={row.original.added_at} title={absoluteDateTime(row.original.added_at)}>
        {relativeTime(row.original.added_at)}
      </time>
    ),
  },
];

interface TalentPoolPageProps {
  reading: PoolReading;
  onReadingChange: (reading: PoolReading) => void;
  onCandidateOpen: (entry: PooledCandidate) => void;
}

export function TalentPoolPage({ reading, onReadingChange, onCandidateOpen }: TalentPoolPageProps) {
  const saved = useSavedCandidates(reading);
  const [dropping, setDropping] = useState<PooledCandidate | null>(null);
  const narrowed = reading.q.trim() !== '';

  return (
    <div className="space-y-(--space-section)">
      <PageHeader title="Talent pool" description={DESCRIPTION} />

      <PoolSearch q={reading.q} onSearch={(q) => onReadingChange({ ...reading, q })} />

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
        sort={{
          by: reading.order,
          onChange: (by) => onReadingChange({ ...reading, order: by as TalentPoolOrder }),
        }}
        empty={{
          icon: Star,
          message: narrowed ? nobodyMatches(reading.q) : NOBODY_SAVED,
          action: narrowed ? (
            <Button variant="outline" onClick={() => onReadingChange({ ...reading, q: '' })}>
              Clear search
            </Button>
          ) : (
            TO_SEARCH
          ),
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
