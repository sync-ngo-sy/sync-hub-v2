import { PageHeaderShell } from '@sync/ui/components/page-header';
import { Button } from '@sync/ui/components/ui/button';
import { Plus } from 'lucide-react';
import type { JobSummary } from '@/features/jobs/job';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { dashboardDate, dashboardGreeting, type TenantApplication } from '../dashboard';
import { useDashboard } from '../hooks/use-dashboard';
import { ActivityStats } from './activity-stats';
import { JobsOverview } from './jobs-overview';
import { RecentApplications } from './recent-applications';
import { SourcesCard } from './sources-card';

interface DashboardPageProps {
  recruiterName: string;
  onJobOpen: (job: JobSummary) => void;
  onApplicationOpen: (application: TenantApplication) => void;
  applicationHref: (application: TenantApplication) => string;
  onCreateJob: () => void;
}

export function DashboardPage({
  recruiterName,
  onJobOpen,
  onApplicationOpen,
  applicationHref,
  onCreateJob,
}: DashboardPageProps) {
  const { tenantName, stats, applications, jobs } = useDashboard();
  const now = new Date();

  return (
    <>
      <WorkspaceHeader>
        <PageHeaderShell
          actions={
            <Button onClick={onCreateJob}>
              <Plus aria-hidden="true" />
              Create job
            </Button>
          }
        >
          <h1 className="font-greeting text-page-title text-foreground">
            {dashboardGreeting(recruiterName, now)}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 text-dense text-muted-foreground">
            {tenantName ? (
              <>
                <span>{tenantName}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <time dateTime={now.toISOString()}>{dashboardDate(now)}</time>
          </p>
        </PageHeaderShell>
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ActivityStats stats={stats} />

        <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
          <RecentApplications
            applications={applications}
            onApplicationOpen={onApplicationOpen}
            applicationHref={applicationHref}
          />

          <div className="space-y-(--space-grid)">
            <SourcesCard stats={stats} />
            <JobsOverview jobs={jobs} onJobOpen={onJobOpen} onCreateJob={onCreateJob} />
          </div>
        </div>
      </div>
    </>
  );
}
