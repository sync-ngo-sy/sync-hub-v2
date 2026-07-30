import { createFileRoute } from '@tanstack/react-router';
import { JobDetailView } from '../features/jobs/components/job-detail-view';
import { JobsBoundary } from '../features/jobs/components/jobs-boundary';
import { useJobByLink } from '../features/jobs/hooks/use-job-by-link';
import { errorStatus } from '../lib/errors';

// The Tracked-link landing: it resolves the link token to its Job and shows it in place — the GET
// counts the view server-side, and the visitor sees no tracking UI at all (see the portal CONTEXT).
export const Route = createFileRoute('/l/$token')({
  component: TrackedLinkPage,
});

function TrackedLinkContent() {
  const { token } = Route.useParams();
  const { data, isPending, error } = useJobByLink(token);

  return (
    <JobDetailView
      job={data}
      isPending={isPending}
      notFound={errorStatus(error) === 404}
      returnTo={`/l/${token}`}
    />
  );
}

function TrackedLinkPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <JobsBoundary context={{ feature: 'tracked-link' }}>
        <TrackedLinkContent />
      </JobsBoundary>
    </div>
  );
}
