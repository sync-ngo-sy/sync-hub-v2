import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { JobWizardPage } from '@/features/jobs/components/job-wizard-page';
import { WIZARD_STEP_VALUES } from '@/features/jobs/wizard';
import { warmLocations } from '@/features/reference/reference-queries';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_workspace/jobs_/new')({
  validateSearch: z.object({ step: z.enum(WIZARD_STEP_VALUES).optional().catch(undefined) }),
  loader: ({ context }) => warmLocations(context.queryClient),
  head: () => ({ meta: [{ title: pageTitle('Create a Job') }] }),
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
        onCreated={(job) =>
          void navigate({ to: '/jobs/$jobId', params: { jobId: job.id }, search: {} })
        }
        onCancel={() => void navigate({ to: '/jobs', search: {} })}
      />
    </WidgetBoundary>
  );
}
