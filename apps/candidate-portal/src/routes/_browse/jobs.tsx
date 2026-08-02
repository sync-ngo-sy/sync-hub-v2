import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { BrowseJobs } from '@/features/jobs/components/browse-jobs';
import { jobFiltersSchema } from '@/features/jobs/filters';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_browse/jobs')({
  validateSearch: jobFiltersSchema,
  head: () => ({ meta: [{ title: pageTitle('Jobs') }] }),
  component: JobsPage,
});

function JobsPage() {
  const { profile } = Route.useRouteContext();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <BrowseJobs
      signedIn={profile !== null}
      filters={filters}
      onFiltersChange={(next) => void navigate({ search: next })}
    />
  );
}
