import { createFileRoute } from '@tanstack/react-router';
import { JobDetailView } from '../features/jobs/components/job-detail-view';
import { JobsBoundary } from '../features/jobs/components/jobs-boundary';
import { usePublicJob } from '../features/jobs/hooks/use-public-job';
import { errorStatus } from '../lib/errors';

export const Route = createFileRoute('/jobs/$jobId')({
  component: JobDetailPage,
});

function JobDetailContent() {
  const { jobId } = Route.useParams();
  const { data, isPending, error } = usePublicJob(jobId);

  return (
    <JobDetailView
      job={data}
      isPending={isPending}
      notFound={errorStatus(error) === 404}
      returnTo={`/jobs/${jobId}`}
    />
  );
}

function JobDetailPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <JobsBoundary context={{ feature: 'job-detail' }}>
        <JobDetailContent />
      </JobsBoundary>
    </div>
  );
}
