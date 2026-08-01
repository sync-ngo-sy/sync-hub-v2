import { PageHeader } from '@sync/ui/components/page-header';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { Button } from '@sync/ui/components/ui/button';
import { ErrorCard } from '@/features/shell/components/error-card';
import { problemMessage } from '@/lib/api-problem';
import { useBrowseJobs } from '../hooks/use-browse-jobs';
import { JobList } from './job-list';
import { NothingPublished } from './nothing-published';

export function BrowseJobs({ signedIn }: { signedIn: boolean }) {
  const jobs = useBrowseJobs();

  return (
    <div className="space-y-8">
      <PageHeader title="Jobs" description="Open roles across Syria, newest first." />

      {jobs.isPending ? (
        <div role="status" aria-label="Loading jobs">
          {/* Enough rows to fill a phone, not the twenty a page holds: the rest would be a wall
              of grey below the fold. */}
          <ListSkeleton rows={6} />
        </div>
      ) : null}

      {jobs.isError ? (
        <ErrorCard
          title="Couldn't load the jobs"
          description={problemMessage(jobs.error, 'Something went wrong on our side.')}
          retryLabel="Try again"
          onRetry={() => void jobs.refetch()}
        />
      ) : null}

      {jobs.data?.length ? <JobList jobs={jobs.data} /> : null}
      {jobs.data?.length === 0 ? <NothingPublished signedIn={signedIn} /> : null}

      {jobs.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void jobs.fetchNextPage()}
            disabled={jobs.isFetchingNextPage}
          >
            {jobs.isFetchingNextPage ? 'Loading…' : 'Load more jobs'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
