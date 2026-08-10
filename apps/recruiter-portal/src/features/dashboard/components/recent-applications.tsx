import { DataTable, type DataTableColumn } from '@sync/ui/components/data-table';
import { StatusMark } from '@sync/ui/components/status-mark';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import {
  candidateIdentity,
  pipelineState,
  screeningState,
} from '@/features/applications/application';
import { CandidateIdentity } from '@/features/candidates/components/candidate-cells';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime, relativeTime } from '@/lib/dates';
import type { TenantApplication } from '../dashboard';
import type { PanelRead } from '../hooks/use-dashboard';
import { DashboardPanel } from './dashboard-panel';

const COLUMNS: DataTableColumn<TenantApplication>[] = [
  {
    id: 'candidate',
    header: 'Candidate',
    cell: ({ row }) => <CandidateIdentity {...candidateIdentity(row.original)} />,
  },
  {
    id: 'job',
    header: 'Job',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.job.title}</span>
    ),
  },
  {
    id: 'received',
    header: 'Received',
    meta: { priority: 'hidden' },
    cell: ({ row }) => (
      <time
        dateTime={row.original.applied_at}
        title={absoluteDateTime(row.original.applied_at)}
        className="text-muted-foreground"
      >
        {relativeTime(row.original.applied_at)}
      </time>
    ),
  },
  {
    id: 'screening',
    header: 'Screening',
    cell: ({ row }) => {
      const state = screeningState(row.original.qualification_status);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
  },
  {
    id: 'pipeline',
    header: 'Pipeline',
    cell: ({ row }) => {
      const state = pipelineState(row.original.status);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
  },
];

interface RecentApplicationsProps {
  applications: PanelRead<TenantApplication[]>;
  onApplicationOpen: (application: TenantApplication) => void;
  applicationHref: (application: TenantApplication) => string;
}

export function RecentApplications({
  applications,
  onApplicationOpen,
  applicationHref,
}: RecentApplicationsProps) {
  const recent = applications.data ?? [];

  return (
    <DashboardPanel
      title="Recent applications"
      description="The newest Applications your Tenant has received, across every Job."
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
        getRowId={(row) => row.id}
        rowLabel={(row) => `${row.candidate_name}'s Application`}
        onRowOpen={onApplicationOpen}
        rowHref={applicationHref}
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
