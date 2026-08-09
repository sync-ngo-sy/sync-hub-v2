import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { ChoicePicker } from '@/features/jobs/components/choice-select';
import { problemMessage } from '@/lib/api-problem';
import {
  type ApplicationSort,
  EVERY_TIME,
  hiddenBehind,
  PIPELINE_STATUSES,
  pipelineSelection,
  pipelineState,
  RECEIVED_RANGES,
  type ReceivedRange,
  receivedSelection,
  receivedWithin,
  SCREENING_VERDICTS,
  screeningSelection,
  screeningState,
  sortSelection,
  type TenantApplication,
} from '../application';
import {
  type TenantApplicationFilters,
  useTenantApplications,
} from '../hooks/use-tenant-applications';
import { applicationColumns } from './application-columns';
import { ChecklistFilter } from './checklist-filter';

const JOB: DataTableColumn<TenantApplication> = {
  id: 'job',
  header: 'Job',
  cell: ({ row }) => (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: row.original.job.id }}
      search={{}}
      onClick={(event) => event.stopPropagation()}
      className="flex min-w-40 flex-col gap-1 rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="font-medium">{row.original.job.title}</span>
      {row.original.job.location_name ? (
        <span className="text-meta text-muted-foreground">{row.original.job.location_name}</span>
      ) : null}
    </Link>
  ),
};

const COLUMNS = applicationColumns<TenantApplication>(JOB);

const NOTHING_YET =
  'No Applications yet — publish a Job and share its tracked links to bring candidates in.';

const TO_THE_JOBS = (
  <Link to="/jobs" search={{}} className={buttonVariants({ variant: 'outline' })}>
    Go to your jobs
  </Link>
);

interface ApplicationsPageProps {
  filters: TenantApplicationFilters;
  onFiltersChange: (filters: TenantApplicationFilters) => void;
  onApplicationOpen: (application: TenantApplication) => void;
}

export function ApplicationsPage({
  filters,
  onFiltersChange,
  onApplicationOpen,
}: ApplicationsPageProps) {
  const pipeline = pipelineSelection(filters.pipeline);
  const screening = screeningSelection(filters.screening);
  const range = receivedSelection(filters.received);
  const sort = sortSelection(filters.sort);
  const applications = useTenantApplications({
    pipeline,
    screening,
    received: filters.received,
    sort,
  });
  const statusCounts = applications.data?.statusCounts ?? {};
  const verdictCounts = applications.data?.verdictCounts ?? {};
  const active = [
    hiddenBehind(SCREENING_VERDICTS, screening, verdictCounts) > 0,
    hiddenBehind(PIPELINE_STATUSES, pipeline, statusCounts) > 0,
    range !== EVERY_TIME,
  ].filter(Boolean).length;

  return (
    <div className="space-y-(--space-section)">
      <PageHeader
        title="Applications"
        description="Everyone who has applied, across every Job your Tenant is hiring for."
      />

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <ChecklistFilter
          label="Screening"
          noun="verdicts"
          options={SCREENING_VERDICTS.map((verdict) => ({
            value: verdict,
            label: screeningState(verdict).label,
          }))}
          selected={screening}
          counts={verdictCounts}
          onChange={(chosen) => onFiltersChange({ ...filters, screening: chosen })}
        />
        <ChecklistFilter
          label="Pipeline"
          noun="statuses"
          options={PIPELINE_STATUSES.map((status) => ({
            value: status,
            label: pipelineState(status).label,
          }))}
          selected={pipeline}
          counts={statusCounts}
          onChange={(chosen) => onFiltersChange({ ...filters, pipeline: chosen })}
        />
        <ChoicePicker
          label="Received"
          items={RECEIVED_RANGES}
          value={range}
          onValueChange={(chosen: ReceivedRange) =>
            onFiltersChange({ ...filters, received: receivedWithin(chosen) })
          }
        />
      </div>

      <DataTable
        label="Applications"
        columns={COLUMNS}
        data={applications.data?.items ?? []}
        getRowId={(application) => application.id}
        rowLabel={(application) => `${application.candidate_name}'s Application`}
        onRowOpen={onApplicationOpen}
        isLoading={applications.isPending}
        sort={{
          by: sort,
          onChange: (by) => onFiltersChange({ ...filters, sort: by as ApplicationSort }),
        }}
        error={
          applications.isError
            ? {
                message: problemMessage(applications.error, "Couldn't load your Applications."),
                onRetry: () => void applications.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Inbox,
          message:
            active === 0
              ? NOTHING_YET
              : active === 1
                ? 'No Application matches that filter.'
                : 'No Application matches these filters.',
          action:
            active > 0 ? (
              <Button
                variant="outline"
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    pipeline: [...PIPELINE_STATUSES],
                    screening: [...SCREENING_VERDICTS],
                    received: undefined,
                  })
                }
              >
                {active === 1 ? 'Clear filter' : 'Clear filters'}
              </Button>
            ) : (
              TO_THE_JOBS
            ),
        }}
        loadMore={{
          hasMore: applications.hasNextPage,
          isLoading: applications.isFetchingNextPage,
          onLoadMore: () => void applications.fetchNextPage(),
        }}
      />
    </div>
  );
}
