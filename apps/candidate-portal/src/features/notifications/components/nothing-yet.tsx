import { EmptyState } from '@sync/ui/components/empty-state';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { NOTHING_YET } from '../notification';

export function NothingYet() {
  return (
    <EmptyState
      icon={Bell}
      message={NOTHING_YET}
      action={
        <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
          Browse jobs
        </Link>
      }
    />
  );
}
