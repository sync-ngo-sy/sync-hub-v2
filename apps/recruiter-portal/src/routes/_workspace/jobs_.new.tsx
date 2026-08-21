import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { JobWizardPage } from '@/features/jobs/components/job-wizard-page';
import { JobWizardSkeleton } from '@/features/jobs/components/job-wizard-skeleton';
import { WIZARD_STEPS } from '@/features/jobs/wizard';
import { warmLocations } from '@/features/reference/reference-queries';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/jobs_/new')({
  validateSearch: z.object({ step: z.enum(WIZARD_STEPS).optional().catch(undefined) }),
  loader: ({ context }) => warmLocations(context.queryClient),
  head: () => ({ meta: [{ title: pageTitle('Create a Job') }] }),
  pendingComponent: JobWizardSkeleton,
  component: NewJobPage,
});

function NewJobPage() {
  const { step = 'details' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <WidgetBoundary name="Create a Job">
      <JobWizardPage
        step={step}
        onStepChange={(next) => void navigate({ search: { step: next }, replace: true })}
        onCreated={(job, unfinished) =>
          void navigate({
            to: '/jobs/$jobId',
            params: { jobId: job.id },
            search: unfinished === 'criteria' ? { tab: 'criteria' } : {},
          })
        }
        onCancel={() => void navigate({ to: '/jobs', search: {} })}
      />
    </WidgetBoundary>
  );
}
