import { PageHeader } from '@sync/ui/components/page-header';
import { StatusMark } from '@sync/ui/components/status-mark';
import { Alert, AlertDescription, AlertTitle } from '@sync/ui/components/ui/alert';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sync/ui/components/ui/tabs';
import { Link } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ApplicationSummary } from '@/features/applications/application';
import { JobApplications } from '@/features/applications/components/job-applications';
import type { ApplicationFilters } from '@/features/applications/hooks/use-job-applications';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
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

interface JobDetailPageProps {
  jobId: string;
  tab: JobDetailTab;
  onTabChange: (tab: JobDetailTab) => void;
  filters: ApplicationFilters;
  onFiltersChange: (filters: ApplicationFilters) => void;
  onApplicationOpen: (application: ApplicationSummary) => void;
}

export function JobDetailPage({
  jobId,
  tab,
  onTabChange,
  filters,
  onFiltersChange,
  onApplicationOpen,
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
    <div className="space-y-(--space-section)">
      <div className="space-y-4">
        <Link to="/jobs" className={buttonVariants({ variant: 'link', size: 'sm' })}>
          Back to Jobs
        </Link>
        <PageHeader
          title={job.title}
          description={job.description}
          actions={jobLifecycleActions(job.status).map((action) => (
            <Button
              key={action.target}
              variant={action.target === 'archived' ? 'outline' : 'default'}
              disabled={change.isPending}
              onClick={() => void move(action)}
            >
              {action.label}
            </Button>
          ))}
        />
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-dense">
          <div>
            <dt className="sr-only">Status</dt>
            <dd>
              <StatusMark label={state.label} tone={state.tone} />
            </dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Location</dt>
            <dd>{job.location_name ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Employment type</dt>
            <dd>{employmentTypeLabel(job.employment_type) ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Work mode</dt>
            <dd>{workModeLabel(job.work_mode) ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Closing date</dt>
            <dd>{job.expires_at ? absoluteDateTime(job.expires_at) : 'No closing date'}</dd>
          </div>
        </dl>
      </div>

      {lifecycleFailure ? (
        <Alert>
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Lifecycle move refused</AlertTitle>
          <AlertDescription>{lifecycleFailure}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => onTabChange(value as JobDetailTab)}>
        <TabsList aria-label="Job details">
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="criteria">Screening criteria</TabsTrigger>
          <TabsTrigger value="links">Tracked links</TabsTrigger>
        </TabsList>
        <TabsContent value="applications">
          <WidgetBoundary name="Applications">
            <JobApplications
              jobId={jobId}
              filters={filters}
              onFiltersChange={onFiltersChange}
              onApplicationOpen={onApplicationOpen}
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
      </Tabs>
    </div>
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
