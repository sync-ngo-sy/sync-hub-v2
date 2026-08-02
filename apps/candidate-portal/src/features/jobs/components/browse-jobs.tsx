import { PageHeader } from '@sync/ui/components/page-header';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { Button } from '@sync/ui/components/ui/button';
import { ErrorCard } from '@/features/shell/components/error-card';
import { problemMessage } from '@/lib/api-problem';
import { isFiltered, type JobFilters, NO_FILTERS } from '../filters';
import { useBrowseJobs } from '../hooks/use-browse-jobs';
import { JobFilterBar } from './job-filter-bar';
import { JobList } from './job-list';
import { NothingMatches } from './nothing-matches';
import { NothingPublished } from './nothing-published';

interface BrowseJobsProps {
  signedIn: boolean;
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
}

export function BrowseJobs({ signedIn, filters, onFiltersChange }: BrowseJobsProps) {
  const jobs = useBrowseJobs(filters);
  const filtered = isFiltered(filters);

  return (
    <div className="space-y-8">
      <PageHeader title="Jobs" description="Open roles across Syria, newest first." />

      {/* Rendered whatever the list is doing, the failed load included: a filter the reader
          cannot reach is a filter they cannot undo. */}
      <JobFilterBar filters={filters} onChange={onFiltersChange} />

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
      {jobs.data?.length === 0 ? (
        filtered ? (
          <NothingMatches onClear={() => onFiltersChange(NO_FILTERS)} />
        ) : (
          <NothingPublished signedIn={signedIn} />
        )
      ) : null}

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
