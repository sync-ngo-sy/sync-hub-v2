import { ChipFilter } from '@sync/ui/components/chip-filter';
import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Handshake } from 'lucide-react';
import { applicationsAddress } from '@/features/applications/reading';
import { ChoicePicker } from '@/features/jobs/components/choice-select';
import { jobColumn } from '@/features/jobs/components/job-column';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { problemMessage } from '@/lib/api-problem';
import { calendarDay } from '@/lib/dates';
import { useFilterableJobs } from '../hooks/use-filterable-jobs';
import { useHireClaims } from '../hooks/use-hire-claims';
import {
  CLAIM_TABS,
  claimState,
  claimTab,
  type HireClaim,
  type HireConfirmation,
  jobChoices,
  jobSelection,
  oneJob,
  tabLabel,
} from '../placement';
import { narrowedBy, noClaimsMessage, type PlacementsReading } from '../reading';

const DESCRIPTION =
  'Everyone your team has said it hired. A claim becomes a Placement when the Candidate confirms it, and until they answer it is neither confirmed nor refused.';

export const PLACEMENT_COLUMNS: DataTableColumn<HireClaim>[] = [
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
    search={applicationsAddress({ pipeline: ['hired'] })}
    className={buttonVariants({ variant: 'outline' })}
  >
    Go to the hired Applications
  </Link>
);

interface PlacementsPageProps {
  reading: PlacementsReading;
  onReadingChange: (reading: PlacementsReading) => void;
  onClaimOpen: (claim: HireClaim) => void;
  claimHref: (claim: HireClaim) => string;
}

export function PlacementsPage({
  reading,
  onReadingChange,
  onClaimOpen,
  claimHref,
}: PlacementsPageProps) {
  const tab = claimTab(reading.tab);
  const claims = useHireClaims(tab, reading.job);
  const counts = claims.data?.counts ?? {};
  const jobs = useFilterableJobs(claims.data?.jobs);

  function whereEmptyLeads() {
    if (narrowedBy(reading) === 0) return TO_THE_HIRED;
    return (
      <Button variant="outline" onClick={() => onReadingChange({ ...reading, job: undefined })}>
        Show every Job
      </Button>
    );
  }

  return (
    <>
      <WorkspaceHeader>
        <PageHeader title="Placements" description={DESCRIPTION} />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <ChipFilter
            label="Hire claims"
            value={tab}
            chips={CLAIM_TABS.map((one) => ({
              value: one,
              label: tabLabel(one),
              count: claims.isPending ? undefined : (counts[one] ?? 0),
            }))}
            onValueChange={(chosen) =>
              onReadingChange({ ...reading, tab: chosen as HireConfirmation })
            }
          />

          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="shrink-0 text-meta text-muted-foreground">
              Job
            </span>
            <ChoicePicker
              label="Job"
              items={jobChoices(jobs)}
              value={jobSelection(reading.job)}
              onValueChange={(chosen) => onReadingChange({ ...reading, job: oneJob(chosen) })}
            />
          </div>
        </div>

        <DataTable
          label={tabLabel(tab)}
          columns={PLACEMENT_COLUMNS}
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
          empty={{
            icon: Handshake,
            message: noClaimsMessage(reading),
            action: whereEmptyLeads(),
          }}
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
