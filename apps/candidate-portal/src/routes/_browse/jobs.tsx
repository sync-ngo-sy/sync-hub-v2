import { createFileRoute } from '@tanstack/react-router';
import { BrowseJobs } from '@/features/jobs/components/browse-jobs';
import { pageTitle } from '@/lib/page-title';

export const Route = createFileRoute('/_browse/jobs')({
  head: () => ({ meta: [{ title: pageTitle('Jobs') }] }),
  component: JobsPage,
});

function JobsPage() {
  const { profile } = Route.useRouteContext();
  return <BrowseJobs signedIn={profile !== null} />;
}
