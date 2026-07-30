import { PageHeader } from '@sync/ui/components/page-header';
import { createFileRoute } from '@tanstack/react-router';
import { JobList } from '../features/jobs/components/job-list';
import { JobsBoundary } from '../features/jobs/components/jobs-boundary';

export const Route = createFileRoute('/jobs/')({
  component: BrowseJobsPage,
});

function BrowseJobsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <PageHeader title="Browse jobs" description="Open roles across Syria, newest first." />
      <JobsBoundary context={{ feature: 'browse-jobs' }}>
        <JobList />
      </JobsBoundary>
    </div>
  );
}
