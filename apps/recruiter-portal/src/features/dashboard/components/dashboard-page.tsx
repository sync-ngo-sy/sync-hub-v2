import { PageHeader } from '@sync/ui/components/page-header';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { ChartColumnIncreasing, ChartSpline, Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateJobDialog } from '@/features/jobs/components/create-job-dialog';
import type { JobSummary } from '@/features/jobs/job';
import type { RecentApplication } from '../dashboard';
import { useDashboard } from '../hooks/use-dashboard';
import { ActivityStats } from './activity-stats';
import { JobsOverview } from './jobs-overview';
import { RecentApplications } from './recent-applications';
import { TrendSlot } from './trend-slot';

interface DashboardPageProps {
  onJobOpen: (job: JobSummary) => void;
  onApplicationOpen: (application: RecentApplication) => void;
}

export function DashboardPage({ onJobOpen, onApplicationOpen }: DashboardPageProps) {
  const { tenantName, jobs, applications } = useDashboard();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-8">
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

      <ActivityStats jobs={jobs} applications={applications} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        <RecentApplications applications={applications} onApplicationOpen={onApplicationOpen} />

        <div className="space-y-6">
          <TrendSlot
            title="Where applicants find you"
            description="Views each tracked link brings, added up across your Jobs."
            icon={ChartSpline}
            coming="Views by channel over time land here once the tenant analytics endpoint ships. Until then, each Job's own tracked links and the views they brought sit on its Tracked links tab."
            action={
              <Link to="/jobs" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Go to Jobs
              </Link>
            }
          />

          <JobsOverview
            jobs={jobs}
            applicationsByJob={applications.data?.byJob}
            onJobOpen={onJobOpen}
            onCreateJob={() => setCreating(true)}
          />
        </div>
      </div>

      <TrendSlot
        title="Pipeline at a glance"
        description="How the Applications your team is working are spread across the Pipeline."
        icon={ChartColumnIncreasing}
        coming="Counts by Pipeline stage land here with the same analytics endpoints. Until then, each Job's Applications tab filters by stage, and Awaiting review above counts what nobody has picked up yet."
      />

      <CreateJobDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
