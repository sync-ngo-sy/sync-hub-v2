import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { JobsPage as JobsFeaturePage } from '@/features/jobs/components/jobs-page';
import { jobsFirstPageQuery } from '@/features/jobs/hooks/use-jobs';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { pageTitle } from '@/lib/page-title';

const jobStatus = z.enum(['draft', 'published', 'closed', 'archived']);

export const Route = createFileRoute('/_workspace/jobs')({
  validateSearch: z.object({ status: jobStatus.optional() }),
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(jobsFirstPageQuery(deps.status)).catch(() => undefined),
  head: () => ({ meta: [{ title: pageTitle('Jobs') }] }),
  component: JobsPage,
});

function JobsPage() {
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <WidgetBoundary name="Jobs">
      <JobsFeaturePage
        status={status}
        onJobOpen={(job) =>
          void navigate({ to: '/jobs/$jobId', params: { jobId: job.id }, search: {} })
        }
        onStatusChange={(nextStatus) =>
          void navigate({ search: nextStatus ? { status: nextStatus } : {}, replace: true })
        }
      />
    </WidgetBoundary>
  );
}
