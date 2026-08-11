import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Badge } from '@sync/ui/components/ui/badge';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Star, Users } from 'lucide-react';
import { problemMessage } from '@/lib/api-problem';
import { listedCard, type SearchableCandidate } from '../candidate';
import { useCandidateDirectory } from '../hooks/use-candidate-directory';
import {
  type CandidateSearchFilters,
  type DirectoryOrder,
  hardFilterCount,
  noCandidatesMessage,
  searchAddress,
} from '../search';
import { CandidateNameCell, NOTHING, yearsOf } from './candidate-cells';

const TO_THE_POOL = (
  <Link to="/talent-pool" className={buttonVariants({ variant: 'outline' })}>
    Go to your talent pool
  </Link>
);

const COLUMNS: DataTableColumn<SearchableCandidate>[] = [
  {
    accessorKey: 'full_name',
    header: 'Name',
    meta: { share: 4, sort: { ascending: 'name', descending: 'name_reversed' } },
    cell: ({ row }) => <CandidateNameCell card={listedCard(row.original)} />,
  },
  {
    accessorKey: 'canonical_role_name',
    header: 'Role',
    meta: { share: 3 },
    cell: ({ row }) => <TruncatedText>{row.original.canonical_role_name ?? NOTHING}</TruncatedText>,
  },
  {
    accessorKey: 'total_experience_years',
    header: 'Experience',
    meta: { sort: { ascending: 'least_experience', descending: 'most_experience' } },
    cell: ({ row }) => yearsOf(row.original.total_experience_years),
  },
  {
    accessorKey: 'language_names',
    header: 'Languages',
    meta: { share: 3 },
    cell: ({ row }) => {
      const spoken = row.original.language_names ?? [];
      return <TruncatedText>{spoken.length > 0 ? spoken.join(', ') : NOTHING}</TruncatedText>;
    },
  },
  {
    accessorKey: 'location_name',
    header: 'Location',
    cell: ({ row }) => row.original.location_name ?? NOTHING,
  },
  {
    accessorKey: 'in_talent_pool',
    header: 'Saved',
    cell: ({ row }) =>
      row.original.in_talent_pool ? (
        <Badge variant="secondary" size="sm">
          <Star aria-hidden="true" className="size-3" />
          In your talent pool
        </Badge>
      ) : (
        NOTHING
      ),
  },
];

interface CandidateDirectoryProps {
  filters: CandidateSearchFilters;
  order: DirectoryOrder;
  onOrderChange: (order: DirectoryOrder) => void;
  onClear: () => void;
}

export function CandidateDirectory({
  filters,
  order,
  onOrderChange,
  onClear,
}: CandidateDirectoryProps) {
  const listed = useCandidateDirectory(filters, order);
  const navigate = useNavigate();
  const router = useRouter();
  const candidateLocation = (person: SearchableCandidate) => ({
    to: '/candidates/$candidateId' as const,
    params: { candidateId: person.candidate_id },
    search: searchAddress(filters),
  });

  return (
    <DataTable
      label="Searchable Candidates"
      columns={COLUMNS}
      data={listed.data?.items ?? []}
      getRowId={(person) => person.candidate_id}
      rowLabel={(person) => listedCard(person).fullName}
      onRowOpen={(person) => void navigate(candidateLocation(person))}
      rowHref={(person) => router.buildLocation(candidateLocation(person)).href}
      isLoading={listed.isPending}
      error={
        listed.isError
          ? {
              message: problemMessage(listed.error, "Couldn't load the directory."),
              onRetry: () => void listed.refetch(),
            }
          : undefined
      }
      sort={{ by: order, onChange: (by) => onOrderChange(by as DirectoryOrder) }}
      empty={{
        icon: Users,
        message: noCandidatesMessage(filters),
        action:
          hardFilterCount(filters) > 0 ? (
            <Button variant="outline" onClick={onClear}>
              Clear filters
            </Button>
          ) : (
            TO_THE_POOL
          ),
      }}
    />
  );
}
