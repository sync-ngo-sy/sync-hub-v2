import { ChipFilter } from '@sync/ui/components/chip-filter';
import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Handshake } from 'lucide-react';
import { applicationsAddress } from '@/features/applications/reading';
import { jobColumn } from '@/features/jobs/components/job-column';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { problemMessage } from '@/lib/api-problem';
import { calendarDay } from '@/lib/dates';
import { useHireClaims } from '../hooks/use-hire-claims';
import {
  CLAIM_TABS,
  claimState,
  type HireClaim,
  type HireConfirmation,
  noClaimsMessage,
  tabLabel,
} from '../placement';

const DESCRIPTION =
  'Everyone your team has said it hired. A claim becomes a Placement when the Candidate confirms it, and until they answer it is neither confirmed nor refused.';

const COLUMNS: DataTableColumn<HireClaim>[] = [
  {
    accessorKey: 'candidate_name',
    header: 'Candidate',
    meta: { share: 1 },
    cell: ({ row }) => (
      <TruncatedText className="font-medium">{row.original.candidate_name}</TruncatedText>
    ),
  },
  jobColumn<HireClaim>(),
  {
    accessorKey: 'start_date',
    header: 'Started',
    cell: ({ row }) => (
      <time dateTime={row.original.start_date}>{calendarDay(row.original.start_date)}</time>
    ),
  },
  {
    accessorKey: 'confirmation',
    header: 'Claim',
    meta: { share: 1 },
    cell: ({ row }) => {
      const state = claimState(row.original);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
  },
];

const TO_THE_HIRED = (
  <Link
    to="/applications"
    search={applicationsAddress({ pipeline: 'hired' })}
    className={buttonVariants({ variant: 'outline' })}
  >
    Go to the hired Applications
  </Link>
);

interface PlacementsPageProps {
  tab: HireConfirmation;
  onTabChange: (tab: HireConfirmation) => void;
  onClaimOpen: (claim: HireClaim) => void;
  claimHref: (claim: HireClaim) => string;
}

export function PlacementsPage({ tab, onTabChange, onClaimOpen, claimHref }: PlacementsPageProps) {
  const claims = useHireClaims(tab);
  const counts = claims.data?.counts ?? {};

  return (
    <>
      <WorkspaceHeader>
        <PageHeader title="Placements" description={DESCRIPTION} />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ChipFilter
          label="Hire claims"
          value={tab}
          chips={CLAIM_TABS.map((one) => ({
            value: one,
            label: tabLabel(one),
            count: claims.isPending ? undefined : (counts[one] ?? 0),
          }))}
          onValueChange={(chosen) => onTabChange(chosen as HireConfirmation)}
        />

        <DataTable
          label={tabLabel(tab)}
          columns={COLUMNS}
          data={claims.data?.items ?? []}
          getRowId={(claim) => claim.application_id}
          rowLabel={(claim) => `${claim.candidate_name}'s Application`}
          onRowOpen={onClaimOpen}
          rowHref={claimHref}
          isLoading={claims.isPending}
          error={
            claims.isError
              ? {
                  message: problemMessage(claims.error, "Couldn't load your Placements."),
                  onRetry: () => void claims.refetch(),
                }
              : undefined
          }
          empty={{ icon: Handshake, message: noClaimsMessage(tab), action: TO_THE_HIRED }}
          loadMore={{
            hasMore: claims.hasNextPage,
            isLoading: claims.isFetchingNextPage,
            onLoadMore: () => void claims.fetchNextPage(),
          }}
        />
      </div>
    </>
  );
}
