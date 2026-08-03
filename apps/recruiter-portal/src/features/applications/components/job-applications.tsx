import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { StatusChip } from '@sync/ui/components/status-chip';
import { Button } from '@sync/ui/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { Inbox } from 'lucide-react';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import {
  type ApplicationStatus,
  type ApplicationSummary,
  candidateMeta,
  PIPELINE_STATUSES,
  pipelineState,
  QUALIFICATION_STATUSES,
  type QualificationStatus,
  screeningState,
} from '../application';
import { type ApplicationFilters, useJobApplications } from '../hooks/use-job-applications';

const COLUMNS: DataTableColumn<ApplicationSummary>[] = [
  {
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
  },
  {
    accessorKey: 'qualification_status',
    header: 'Screening',
    cell: ({ row }) => {
      const state = screeningState(row.original.qualification_status);
      return <StatusChip label={state.label} tone={state.tone} />;
    },
  },
  {
    accessorKey: 'status',
    header: 'Pipeline',
    cell: ({ row }) => {
      const state = pipelineState(row.original.status);
      return <StatusChip label={state.label} tone={state.tone} />;
    },
  },
  {
    accessorKey: 'applied_at',
    header: 'Received',
    cell: ({ row }) => (
      <time dateTime={row.original.applied_at} title={absoluteDateTime(row.original.applied_at)}>
        {relativeTime(row.original.applied_at)}
      </time>
    ),
  },
];

interface FilterControlProps<TValue extends string> {
  label: string;
  anyLabel: string;
  value: TValue | undefined;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue | undefined) => void;
}

function FilterControl<TValue extends string>({
  label,
  anyLabel,
  value,
  options,
  onChange,
}: FilterControlProps<TValue>) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3">
      <span className="shrink-0 text-meta text-muted-foreground">{label}</span>
      <Tabs
        className="min-w-0 overflow-x-auto"
        value={value ?? 'all'}
        onValueChange={(next) => onChange(next === 'all' ? undefined : (next as TValue))}
      >
        <TabsList aria-label={label}>
          <TabsTrigger value="all">{anyLabel}</TabsTrigger>
          {options.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

interface JobApplicationsProps {
  jobId: string;
  filters: ApplicationFilters;
  onFiltersChange: (filters: ApplicationFilters) => void;
  onApplicationOpen: (application: ApplicationSummary) => void;
  onShowLinks: () => void;
}

export function JobApplications({
  jobId,
  filters,
  onFiltersChange,
  onApplicationOpen,
  onShowLinks,
}: JobApplicationsProps) {
  const applications = useJobApplications(jobId, filters);
  const filtered = Boolean(filters.status || filters.qualification);

  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <FilterControl<QualificationStatus>
          label="Screening"
          anyLabel="All verdicts"
          value={filters.qualification}
          options={QUALIFICATION_STATUSES.map((status) => ({
            value: status,
            label: screeningState(status).label,
          }))}
          onChange={(qualification) => onFiltersChange({ ...filters, qualification })}
        />
        <FilterControl<ApplicationStatus>
          label="Pipeline"
          anyLabel="All statuses"
          value={filters.status}
          options={PIPELINE_STATUSES.map((status) => ({
            value: status,
            label: pipelineState(status).label,
          }))}
          onChange={(status) => onFiltersChange({ ...filters, status })}
        />
      </div>

      <DataTable
        label="Applications"
        columns={COLUMNS}
        data={applications.data ?? []}
        getRowId={(application) => application.id}
        rowLabel={(application) => `${application.candidate_name}'s Application`}
        onRowOpen={onApplicationOpen}
        isLoading={applications.isPending}
        error={
          applications.isError
            ? {
                message: problemMessage(applications.error, "Couldn't load these Applications."),
                onRetry: () => void applications.refetch(),
              }
            : undefined
        }
        empty={{
          icon: Inbox,
          message: filtered
            ? 'No Application on this Job matches both filters.'
            : 'No one has applied yet — a tracked link is the quickest way to bring candidates to this Job.',
          action: filtered ? (
            <Button
              variant="outline"
              onClick={() => onFiltersChange({ status: undefined, qualification: undefined })}
            >
              Clear filters
            </Button>
          ) : (
            <Button variant="outline" onClick={onShowLinks}>
              Go to tracked links
            </Button>
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
