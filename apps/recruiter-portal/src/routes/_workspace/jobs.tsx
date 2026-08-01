import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { JobsPage as JobsFeaturePage } from '@/features/jobs/components/jobs-page';
import { pageTitle } from '@/lib/page-title';

const jobStatus = z.enum(['draft', 'published', 'closed', 'archived']);

export const Route = createFileRoute('/_workspace/jobs')({
  validateSearch: z.object({ status: jobStatus.optional() }),
  head: () => ({ meta: [{ title: pageTitle('Jobs') }] }),
  component: JobsPage,
});

function JobsPage() {
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <JobsFeaturePage
      status={status}
      onStatusChange={(nextStatus) =>
        void navigate({ search: nextStatus ? { status: nextStatus } : {}, replace: true })
      }
    />
  );
}
