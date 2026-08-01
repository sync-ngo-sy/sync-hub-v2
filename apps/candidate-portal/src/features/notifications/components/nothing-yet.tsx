import { EmptyState } from '@sync/ui/components/empty-state';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';

export function NothingYet() {
  return (
    <EmptyState
      icon={Bell}
      message="Nothing yet. When one of your applications moves, or a CV can't be read, you'll hear about it here."
      action={
        <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
          Browse jobs
        </Link>
      }
    />
  );
}
