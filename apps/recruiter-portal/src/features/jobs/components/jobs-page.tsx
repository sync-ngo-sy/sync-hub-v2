import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { TruncatedText } from '@sync/ui/components/truncated-text';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Tabs } from '@sync/ui/components/ui/tabs';
import { BriefcaseBusiness, CircleAlert, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LineTabsList } from '@/features/shell/components/line-tabs-list';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { useMyTenant } from '@/features/tenant/hooks/use-my-tenant';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useChangeJob } from '../hooks/use-job-actions';
import { useJobs } from '../hooks/use-jobs';
import {
  DEFAULT_JOB_SORT,
  JOB_SORTS,
  JOB_STATUS_VALUES,
  type JobLifecycleAction,
  type JobSort,
  type JobStatus,
  type JobSummary,
  jobLifecycleActions,
  jobMeta,
  jobState,
  WORK_MODE_LABELS,
  type WorkMode,
} from '../job';
import { ChoicePicker } from './choice-select';
import { EditJobDialog } from './edit-job-dialog';
import { JobSearch } from './job-search';

const COLUMNS: DataTableColumn<JobSummary>[] = [
  {
    accessorKey: 'title',
    header: 'Job',
    meta: { share: 5 },
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col gap-1">
        <TruncatedText>{row.original.title}</TruncatedText>
        <TruncatedText className="text-meta font-normal text-muted-foreground">
          {jobMeta(row.original)}
        </TruncatedText>
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const state = jobState(row.original.status);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
  },
  {
    accessorKey: 'view_count',
    header: 'Views',
    cell: ({ row }) => <span className="font-mono tabular-nums">{row.original.view_count}</span>,
  },
  {
    accessorKey: 'application_count',
    header: 'Applications',
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">{row.original.application_count}</span>
    ),
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: ({ row }) => (
      <time dateTime={row.original.updated_at} title={absoluteDateTime(row.original.updated_at)}>
        {relativeTime(row.original.updated_at)}
      </time>
    ),
  },
];

const WORK_MODES = { '': 'Any work mode', ...WORK_MODE_LABELS };

interface JobsPageProps {
  q?: string;
  status?: JobStatus;
  sort?: JobSort;
  workMode?: WorkMode;
  onQueryChange: (q?: string) => void;
  onStatusChange: (status?: JobStatus) => void;
  onSortChange: (sort: JobSort) => void;
  onWorkModeChange: (workMode?: WorkMode) => void;
  onJobOpen: (job: JobSummary) => void;
  jobHref: (job: JobSummary) => string;
  onCreateJob: () => void;
}

export function JobsPage({
  q,
  status,
  sort = DEFAULT_JOB_SORT,
  workMode,
  onQueryChange,
  onStatusChange,
  onSortChange,
  onWorkModeChange,
  onJobOpen,
  jobHref,
  onCreateJob,
}: JobsPageProps) {
  const tenant = useMyTenant();
  const jobs = useJobs({ status, sort, q, workMode });
  const change = useChangeJob();
  const [editing, setEditing] = useState<JobSummary | null>(null);
  const [lifecycleFailure, setLifecycleFailure] = useState<string | null>(null);
  const counts = jobs.data?.statusCounts;
  const total = JOB_STATUS_VALUES.reduce((sum, value) => sum + (counts?.[value] ?? 0), 0);
  const tabs = [
    { value: 'all', label: 'All', count: total },
    ...JOB_STATUS_VALUES.map((value) => ({
      value,
      label: jobState(value).label,
      count: counts?.[value] ?? 0,
    })),
  ];

  async function move(job: JobSummary, action: JobLifecycleAction) {
    setLifecycleFailure(null);
    try {
      await change.mutateAsync({
        params: { path: { job_id: job.id } },
        body: { status: action.target },
      });
      toast.success(action.success);
    } catch (error) {
      setLifecycleFailure(
        problemMessage(error, `${job.title} couldn't move to ${jobState(action.target).label}.`),
      );
    }
  }

  return (
    <>
      <WorkspaceHeader withTabs>
        <PageHeader
          title="Jobs"
          description={
            tenant.data
              ? `Every role created by ${tenant.data.name}`
              : 'Every role created by your Tenant'
          }
          actions={
            <Button onClick={onCreateJob}>
              <Plus aria-hidden="true" />
              Create job
            </Button>
          }
        />

        <Tabs
          className="min-w-full gap-0"
          value={status ?? 'all'}
          onValueChange={(value) =>
            onStatusChange(value === 'all' ? undefined : (value as JobStatus))
          }
        >
          <LineTabsList
            label="Status"
            value={status ?? 'all'}
            tabs={tabs}
            className="-mb-px mt-5"
          />
        </Tabs>
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <JobSearch q={q} onQueryChange={onQueryChange} />

          <div className="flex flex-wrap items-center gap-3">
            <ChoicePicker
              items={WORK_MODES}
              value={workMode ?? ''}
              onValueChange={(chosen) => onWorkModeChange(chosen || undefined)}
              label="Work mode"
            />
            <ChoicePicker
              items={JOB_SORTS}
              value={sort}
              onValueChange={onSortChange}
              label="Order"
            />
          </div>
        </div>

        {lifecycleFailure ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Lifecycle move refused</AlertTitle>
            <AlertDescription>{lifecycleFailure}</AlertDescription>
          </Alert>
        ) : null}

        <DataTable
          label="Jobs"
          columns={COLUMNS}
          data={jobs.data?.items ?? []}
          getRowId={(job) => job.id}
          rowLabel={(job) => job.title}
          onRowOpen={onJobOpen}
          rowHref={jobHref}
          rowActions={(job) => [
            { label: 'Edit job', onSelect: () => setEditing(job) },
            ...jobLifecycleActions(job.status).map((action) => ({
              label: action.label,
              onSelect: () => void move(job, action),
            })),
          ]}
          isLoading={jobs.isPending}
          empty={{
            icon: BriefcaseBusiness,
            message: q
              ? `No Jobs have a title matching “${q}”.`
              : workMode
                ? `No ${WORK_MODE_LABELS[workMode].toLowerCase()} Jobs match this view.`
                : status
                  ? `No ${jobState(status).label.toLowerCase()} Jobs match this view.`
                  : 'No Jobs yet — write the first role your Tenant is hiring for.',
            action: q ? (
              <Button onClick={() => onQueryChange(undefined)}>Clear search</Button>
            ) : workMode ? (
              <Button onClick={() => onWorkModeChange(undefined)}>Clear work mode</Button>
            ) : (
              <Button onClick={onCreateJob}>
                {status ? 'Create job' : 'Create your first job'}
              </Button>
            ),
          }}
          loadMore={{
            hasMore: jobs.hasNextPage,
            isLoading: jobs.isFetchingNextPage,
            onLoadMore: () => void jobs.fetchNextPage(),
          }}
        />

        {editing ? (
          <WidgetBoundary name="Edit Job">
            <EditJobDialog
              jobId={editing.id}
              open
              onOpenChange={(open) => {
                if (!open) setEditing(null);
              }}
            />
          </WidgetBoundary>
        ) : null}
      </div>
    </>
  );
}
