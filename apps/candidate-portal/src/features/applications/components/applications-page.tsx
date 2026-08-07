import { EmptyState } from '@sync/ui/components/empty-state';
import { PageHeader } from '@sync/ui/components/page-header';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { ErrorCard } from '@/features/shell/components/error-card';
import { problemMessage } from '@/lib/api-problem';
import { useMyApplications } from '../hooks/use-my-applications';
import { ApplicationCard } from './application-card';

export function ApplicationsPage() {
  const applications = useMyApplications();

  return (
    <div className="space-y-(--space-section)">
      <PageHeader title="My Applications" description="Everywhere you've applied, newest first." />

      {applications.isPending ? (
        <div role="status" aria-label="Loading your Applications">
          <ListSkeleton rows={5} />
        </div>
      ) : null}

      {applications.isError ? (
        <ErrorCard
          title="Couldn't load your Applications"
          description={problemMessage(applications.error, 'Something went wrong on our side.')}
          onRetry={() => void applications.refetch()}
        />
      ) : null}

      {applications.data?.length ? (
        <ul
          aria-label="Your Applications"
          className="divide-y divide-border border-t border-border"
        >
          {applications.data.map((application) => (
            <li key={application.id}>
              <ApplicationCard application={application} />
            </li>
          ))}
        </ul>
      ) : null}

      {applications.data?.length === 0 ? (
        <EmptyState
          icon={Search}
          message="No applications yet — find a job you like and apply."
          action={
            <Link to="/jobs" className={buttonVariants()}>
              Browse jobs
            </Link>
          }
        />
      ) : null}

      {applications.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={applications.isFetchingNextPage}
            onClick={() => void applications.fetchNextPage()}
          >
            {applications.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
