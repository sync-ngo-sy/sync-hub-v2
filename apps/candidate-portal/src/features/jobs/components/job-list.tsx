import { EmptyState } from '@sync/ui/components/empty-state';
import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';
import { useBrowseJobs } from '../hooks/use-browse-jobs';
import { JobListSkeleton } from './job-skeletons';
import { JobSummaryCard } from './job-summary-card';

export function JobList() {
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useBrowseJobs();

  // A first-page failure throws to the boundary, so a resolved list always has data.
  if (isPending || !data) return <JobListSkeleton />;

  const jobs = data.pages.flatMap((page) => page.items);

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase />}
        title="No open roles right now"
        description="New Jobs are published often. Check back soon."
        action={<Button variant="outline" render={<Link to="/">Back to Sync</Link>} />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobSummaryCard job={job} />
          </li>
        ))}
      </ul>
      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
