import { PageHeader } from '@sync/ui/components/page-header';
import { Button } from '@sync/ui/components/ui/button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateJobDialog } from '@/features/jobs/components/create-job-dialog';
import type { JobSummary } from '@/features/jobs/job';
import type { TenantApplication } from '../dashboard';
import { useDashboard } from '../hooks/use-dashboard';
import { ActivityStats } from './activity-stats';
import { JobsOverview } from './jobs-overview';
import { RecentApplications } from './recent-applications';
import { SourcesCard } from './sources-card';

interface DashboardPageProps {
  onJobOpen: (job: JobSummary) => void;
  onApplicationOpen: (application: TenantApplication) => void;
}

export function DashboardPage({ onJobOpen, onApplicationOpen }: DashboardPageProps) {
  const { tenantName, stats, applications, jobs } = useDashboard();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-(--space-section)">
      <PageHeader
        title="Dashboard"
        description={tenantName}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Create job
          </Button>
        }
      />

      <ActivityStats stats={stats} />

      <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        <RecentApplications applications={applications} onApplicationOpen={onApplicationOpen} />

        <div className="space-y-(--space-grid)">
          <SourcesCard stats={stats} />
          <JobsOverview jobs={jobs} onJobOpen={onJobOpen} onCreateJob={() => setCreating(true)} />
        </div>
      </div>

      <CreateJobDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
