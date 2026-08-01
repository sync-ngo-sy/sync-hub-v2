import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { PageHeader } from '@sync/ui/components/page-header';
import { StatusChip } from '@sync/ui/components/status-chip';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button } from '@sync/ui/components/ui/button';
import { Label } from '@sync/ui/components/ui/label';
import { BriefcaseBusiness, CircleAlert, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { problemMessage } from '@/lib/api-problem';
import { useChangeJob } from '../hooks/use-job-actions';
import { useJobs } from '../hooks/use-jobs';
import {
  type JobLifecycleAction,
  type JobStatus,
  type JobSummary,
  jobDate,
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
      return <StatusChip label={state.label} tone={state.tone} />;
    },
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: ({ row }) => (
      <time dateTime={row.original.updated_at}>{jobDate(row.original.updated_at)}</time>
    ),
  },
];

interface JobsPageProps {
  status?: JobStatus;
  onStatusChange: (status?: JobStatus) => void;
}

export function JobsPage({ status, onStatusChange }: JobsPageProps) {
  const jobs = useJobs(status);
  const change = useChangeJob(status);
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
    <div className="space-y-8">
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

      <div className="flex items-center gap-3">
        <Label htmlFor="jobs-status">Status</Label>
        <select
          id="jobs-status"
          value={status ?? ''}
          onChange={(event) =>
            onStatusChange((event.target.value || undefined) as JobStatus | undefined)
          }
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-dense outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {lifecycleFailure ? (
        <Alert variant="destructive">
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
        onRowOpen={setEditing}
        rowActions={(job) => [
          { label: 'Edit job', onSelect: () => setEditing(job) },
          ...jobLifecycleActions(job.status).map((action) => ({
            label: action.label,
            onSelect: () => void move(job, action),
          })),
        ]}
        isLoading={jobs.isPending}
        error={
          jobs.isError
            ? {
                message: problemMessage(jobs.error, "Couldn't load your Jobs."),
                onRetry: () => void jobs.refetch(),
              }
            : undefined
        }
        empty={{
          icon: BriefcaseBusiness,
          message: status
            ? `No ${jobState(status).label.toLowerCase()} Jobs match this view.`
            : 'No Jobs yet — write the first role your Tenant is hiring for.',
          action: <Button onClick={() => setCreating(true)}>Create your first job</Button>,
        }}
        loadMore={{
          hasMore: jobs.hasNextPage,
          isLoading: jobs.isFetchingNextPage,
          onLoadMore: () => void jobs.fetchNextPage(),
        }}
      />

      <CreateJobDialog open={creating} onOpenChange={setCreating} status={status} />
      {editing ? (
        <EditJobDialog
          jobId={editing.id}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          status={status}
        />
      ) : null}
    </div>
  );
}
