import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { ChoicePicker } from '@/features/jobs/components/choice-select';
import { jobPlace } from '@/features/jobs/job';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { problemMessage } from '@/lib/api-problem';
import {
  ALL_TAB,
  type ApplicationSort,
  anythingEnded,
  pipelineStatuses,
  pipelineTab,
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
import { useTenantApplications } from '../hooks/use-tenant-applications';
import {
  clearFiltersLabel,
  narrowedBy,
  noApplicationsMessage,
  type TenantApplicationFilters,
} from '../reading';
import { applicationColumns } from './application-columns';
import { ApplicationPipelineFilter } from './application-pipeline-filter';
import { ChecklistFilter } from './checklist-filter';

const JOB: DataTableColumn<TenantApplication> = {
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

function JobPlace({ job }: { job: TenantApplication['job'] }) {
  const place = jobPlace(job);
  if (place === null) return null;

  return <TruncatedText className="text-meta text-muted-foreground">{place}</TruncatedText>;
}

export const TENANT_APPLICATION_COLUMNS = applicationColumns<TenantApplication>(JOB);

const TO_THE_JOBS = (
  <Link to="/jobs" search={{}} className={buttonVariants({ variant: 'outline' })}>
    Go to your jobs
  </Link>
);

interface ApplicationsPageProps {
  filters: TenantApplicationFilters;
  onFiltersChange: (filters: TenantApplicationFilters) => void;
  onApplicationOpen: (application: TenantApplication) => void;
  applicationHref: (application: TenantApplication) => string;
}

export function ApplicationsPage({
  filters,
  onFiltersChange,
  onApplicationOpen,
  applicationHref,
}: ApplicationsPageProps) {
  const pipeline = pipelineTab(filters.pipeline);
  const screening = screeningSelection(filters.screening);
  const range = receivedSelection(filters.received);
  const sort = sortSelection(filters.sort);
  const applications = useTenantApplications({
    statuses: pipelineStatuses(pipeline),
    verdicts: screening,
    received: filters.received,
    sort,
  });
  const statusCounts = applications.data?.statusCounts ?? {};
  const verdictCounts = applications.data?.verdictCounts ?? {};
  const narrowing = narrowedBy(filters);
  const ended = anythingEnded(statusCounts);

  function whereEmptyLeads() {
    if (narrowing > 0) {
      return (
        <Button
          variant="outline"
          onClick={() =>
            onFiltersChange({
              ...filters,
              pipeline: undefined,
              screening: undefined,
              received: undefined,
            })
          }
        >
          {clearFiltersLabel(filters)}
        </Button>
      );
    }
    if (ended) {
      return (
        <Button
          variant="outline"
          onClick={() => onFiltersChange({ ...filters, pipeline: ALL_TAB })}
        >
          Go to all Applications
        </Button>
      );
    }
    return TO_THE_JOBS;
  }

  return (
    <>
      <WorkspaceHeader>
        <PageHeader
          title="Applications"
          description="Everyone who has applied, across every Job your Tenant is hiring for."
        />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <ApplicationPipelineFilter
            pipeline={pipeline}
            counts={statusCounts}
            onChange={(chosen) => onFiltersChange({ ...filters, pipeline: chosen })}
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
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="shrink-0 text-meta text-muted-foreground">
                Received
              </span>
              <ChoicePicker
                label="Received"
                items={RECEIVED_RANGES}
                value={range}
                onValueChange={(chosen: ReceivedRange) =>
                  onFiltersChange({ ...filters, received: receivedWithin(chosen) })
                }
              />
            </div>
          </div>
        </div>

        <DataTable
          label="Applications"
          columns={TENANT_APPLICATION_COLUMNS}
          data={applications.data?.items ?? []}
          getRowId={(application) => application.id}
          rowLabel={(application) => `${application.candidate_name}'s Application`}
          onRowOpen={onApplicationOpen}
          rowHref={applicationHref}
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
            message: noApplicationsMessage(filters, ended),
            action: whereEmptyLeads(),
          }}
          loadMore={{
            hasMore: applications.hasNextPage,
            isLoading: applications.isFetchingNextPage,
            onLoadMore: () => void applications.fetchNextPage(),
          }}
        />
      </div>
    </>
  );
}
