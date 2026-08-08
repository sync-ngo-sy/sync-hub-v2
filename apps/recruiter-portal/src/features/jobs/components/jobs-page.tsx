import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync/ui/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { BriefcaseBusiness, CircleAlert, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import { useChangeJob } from '../hooks/use-job-actions';
import { useJobs } from '../hooks/use-jobs';
import {
  DEFAULT_JOB_SORT,
  JOB_SORTS,
  type JobLifecycleAction,
  type JobSort,
  type JobStatus,
  type JobSummary,
  jobLifecycleActions,
  jobMeta,
  jobState,
} from '../job';
import { CreateJobDialog } from './create-job-dialog';
import { EditJobDialog } from './edit-job-dialog';

const COLUMNS: DataTableColumn<JobSummary>[] = [
  {
    accessorKey: 'title',
    header: 'Job',
    cell: ({ row }) => (
      <span className="flex min-w-52 flex-col gap-1">
        <span>{row.original.title}</span>
        <span className="text-meta font-normal text-muted-foreground">{jobMeta(row.original)}</span>
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
    cell: ({ row }) => <span className="tabular-nums">{row.original.view_count}</span>,
  },
  {
    accessorKey: 'application_count',
    header: 'Applications',
    cell: ({ row }) => <span className="tabular-nums">{row.original.application_count}</span>,
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

interface JobsPageProps {
  status?: JobStatus;
  sort?: JobSort;
  onStatusChange: (status?: JobStatus) => void;
  onSortChange: (sort: JobSort) => void;
  onJobOpen: (job: JobSummary) => void;
}

export function JobsPage({
  status,
  sort = DEFAULT_JOB_SORT,
  onStatusChange,
  onSortChange,
  onJobOpen,
}: JobsPageProps) {
  const jobs = useJobs(status, sort);
  const change = useChangeJob();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<JobSummary | null>(null);
  const [lifecycleFailure, setLifecycleFailure] = useState<string | null>(null);

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
    <div className="space-y-(--space-section)">
      <PageHeader
        title="Jobs"
        description="Draft, publish and close the roles your Tenant is hiring for."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Create job
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status ?? 'all'}
          onValueChange={(value) =>
            onStatusChange(value === 'all' ? undefined : (value as JobStatus))
          }
        >
          <TabsList aria-label="Status">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          items={JOB_SORTS}
          value={sort}
          onValueChange={(value) => {
            if (value !== null) onSortChange(value as JobSort);
          }}
        >
          <SelectTrigger aria-label="Order">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(JOB_SORTS) as [JobSort, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        data={jobs.data ?? []}
        getRowId={(job) => job.id}
        rowLabel={(job) => job.title}
        onRowOpen={onJobOpen}
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
          message: status
            ? `No ${jobState(status).label.toLowerCase()} Jobs match this view.`
            : 'No Jobs yet — write the first role your Tenant is hiring for.',
          action: (
            <Button onClick={() => setCreating(true)}>
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

      <CreateJobDialog open={creating} onOpenChange={setCreating} />
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
  );
}
