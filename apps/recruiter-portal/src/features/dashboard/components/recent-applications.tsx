import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { StatusChip } from '@sync/ui/components/status-chip';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { candidateMeta, pipelineState, screeningState } from '@/features/applications/application';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import type { ApplicationsRead, RecentApplication } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';
import { DashboardPanel } from './dashboard-panel';

const COLUMNS: DataTableColumn<RecentApplication>[] = [
  {
    id: 'candidate',
    header: 'Candidate',
    cell: ({ row }) => {
      const meta = candidateMeta(row.original.application);
      return (
        <span className="flex min-w-40 flex-col gap-1">
          <span>{row.original.application.candidate_name}</span>
          {meta ? (
            <span className="text-meta font-normal text-muted-foreground">{meta}</span>
          ) : null}
        </span>
      );
    },
  },
  {
    id: 'job',
    header: 'Job',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.job.title}</span>,
  },
  {
    id: 'received',
    header: 'Received',
    cell: ({ row }) => (
      <time
        dateTime={row.original.application.applied_at}
        title={absoluteDateTime(row.original.application.applied_at)}
        className="text-muted-foreground"
      >
        {relativeTime(row.original.application.applied_at)}
      </time>
    ),
  },
  {
    id: 'screening',
    header: 'Screening',
    cell: ({ row }) => {
      const state = screeningState(row.original.application.qualification_status);
      return <StatusChip label={state.label} tone={state.tone} />;
    },
  },
  {
    id: 'pipeline',
    header: 'Pipeline',
    cell: ({ row }) => {
      const state = pipelineState(row.original.application.status);
      return <StatusChip label={state.label} tone={state.tone} />;
    },
  },
];

interface RecentApplicationsProps {
  applications: PanelRead<ApplicationsRead>;
  onApplicationOpen: (application: RecentApplication) => void;
}

export function RecentApplications({ applications, onApplicationOpen }: RecentApplicationsProps) {
  const recent = applications.data?.recent ?? [];

  return (
    <DashboardPanel
      title="Recent applications"
      description="The newest Applications across your published Jobs."
      footer={
        recent.length > 0 ? (
          <span>
            Every Application lives on its Job — open one for its whole triage list.{' '}
            <Link to="/jobs" className={buttonVariants({ variant: 'link', size: 'sm' })}>
              Go to Jobs
            </Link>
          </span>
        ) : undefined
      }
    >
      <DataTable
        label="Recent applications"
        columns={COLUMNS}
        data={recent}
        getRowId={(row) => row.application.id}
        rowLabel={(row) => `${row.application.candidate_name}'s Application`}
        onRowOpen={onApplicationOpen}
        isLoading={applications.isPending}
        error={
          applications.error
            ? {
                message: problemMessage(
                  applications.error,
                  "Couldn't load your recent Applications.",
                ),
                onRetry: applications.refetch,
              }
            : undefined
        }
        empty={{
          icon: Inbox,
          message:
            'No one has applied yet — publish a Job and share a tracked link to bring candidates to it.',
          action: (
            <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
              Go to Jobs
            </Link>
          ),
        }}
      />
    </DashboardPanel>
  );
}
