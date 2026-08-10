import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Tabs, TabsContent } from '@sync/ui/components/ui/tabs';
import { Link } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ApplicationSummary } from '@/features/applications/application';
import { JobApplications } from '@/features/applications/components/job-applications';
import type { ApplicationFilters } from '@/features/applications/reading';
import { FactGrid } from '@/features/shell/components/fact-grid';
import { LineTabsList } from '@/features/shell/components/line-tabs-list';
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { WorkspaceHeader } from '@/features/shell/components/workspace-header';
import { jobTrail } from '@/features/shell/origin';
import { TrackedLinks } from '@/features/tracked-links/components/tracked-links';
import { problemMessage } from '@/lib/api-problem';
import { absoluteDateTime } from '@/lib/dates';
import { useJob } from '../hooks/use-job';
import { useChangeJob } from '../hooks/use-job-actions';
import {
  employmentTypeLabel,
  type JobLifecycleAction,
  jobLifecycleActions,
  jobState,
  workModeLabel,
} from '../job';
import { CriteriaForm } from './criteria-form';

export type JobDetailTab = 'applications' | 'criteria' | 'links';

const JOB_DETAIL_TABS = [
  { value: 'applications', label: 'Applications' },
  { value: 'criteria', label: 'Screening criteria' },
  { value: 'links', label: 'Tracked links' },
];

interface JobDetailPageProps {
  jobId: string;
  tab: JobDetailTab;
  onTabChange: (tab: JobDetailTab) => void;
  filters: ApplicationFilters;
  onFiltersChange: (filters: ApplicationFilters) => void;
  onApplicationOpen: (application: ApplicationSummary) => void;
  applicationHref: (application: ApplicationSummary) => string;
}

export function JobDetailPage({
  jobId,
  tab,
  onTabChange,
  filters,
  onFiltersChange,
  onApplicationOpen,
  applicationHref,
}: JobDetailPageProps) {
  const { data: job } = useJob(jobId);
  const change = useChangeJob();
  const [lifecycleFailure, setLifecycleFailure] = useState<string | null>(null);

  if (!job) return null;
  const jobTitle = job.title;

  async function move(action: JobLifecycleAction) {
    setLifecycleFailure(null);
    try {
      await change.mutateAsync({
        params: { path: { job_id: jobId } },
        body: { status: action.target },
      });
      toast.success(action.success);
    } catch (error) {
      setLifecycleFailure(
        problemMessage(error, `${jobTitle} couldn't move to ${jobState(action.target).label}.`),
      );
    }
  }

  const state = jobState(job.status);

  return (
    <Tabs
      className="gap-0"
      value={tab}
      onValueChange={(value) => onTabChange(value as JobDetailTab)}
    >
      <WorkspaceHeader withTabs>
        <PageBreadcrumbs trail={jobTrail(job.title)} />

        <PageHeader
          className="mt-5"
          title={job.title}
          description={job.description}
          actions={jobLifecycleActions(job.status).map((action) => (
            <Button
              key={action.target}
              variant={action.target === 'archived' ? 'outline' : 'default'}
              className={
                action.target === 'archived'
                  ? 'border-input bg-input-background hover:bg-muted'
                  : undefined
              }
              disabled={change.isPending}
              onClick={() => void move(action)}
            >
              {action.label}
            </Button>
          ))}
        />
        <div className="mt-5">
          <FactGrid
            label="Job facts"
            facts={[
              { label: 'Status', value: <StatusMark label={state.label} tone={state.tone} /> },
              { label: 'Location', value: job.location_name ?? 'Not set' },
              {
                label: 'Employment type',
                value: employmentTypeLabel(job.employment_type) ?? 'Not set',
              },
              { label: 'Work mode', value: workModeLabel(job.work_mode) ?? 'Not set' },
              {
                label: 'Closing date',
                value: job.expires_at ? (
                  <time dateTime={job.expires_at}>{absoluteDateTime(job.expires_at)}</time>
                ) : (
                  'No closing date'
                ),
              },
            ]}
          />
        </div>

        <LineTabsList
          label="Job details"
          value={tab}
          tabs={JOB_DETAIL_TABS}
          className="-mb-px mt-5"
        />
      </WorkspaceHeader>

      <div className="space-y-(--space-section) pt-(--space-section)">
        {lifecycleFailure ? (
          <Alert>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Lifecycle move refused</AlertTitle>
            <AlertDescription>{lifecycleFailure}</AlertDescription>
          </Alert>
        ) : null}

        <TabsContent value="applications">
          <WidgetBoundary name="Applications">
            <JobApplications
              jobId={jobId}
              filters={filters}
              onFiltersChange={onFiltersChange}
              onApplicationOpen={onApplicationOpen}
              applicationHref={applicationHref}
              onShowLinks={() => onTabChange('links')}
            />
          </WidgetBoundary>
        </TabsContent>
        <TabsContent value="criteria">
          <CriteriaForm job={job} />
        </TabsContent>
        <TabsContent value="links">
          <WidgetBoundary name="Tracked links">
            <TrackedLinks jobId={jobId} />
          </WidgetBoundary>
        </TabsContent>
      </div>
    </Tabs>
  );
}

export function JobNotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <h1 className="font-heading text-h3 text-foreground">Job not found</h1>
      <p className="text-dense text-muted-foreground">
        This Job may have been removed, or the address may be wrong.
      </p>
      <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
        Back to Jobs
      </Link>
    </div>
  );
}
