import { EmptyState } from '@sync/ui/components/empty-state';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';
import { NOTHING_PUBLISHED } from '../job';

export function NothingPublished({ signedIn }: { signedIn: boolean }) {
  return (
    <EmptyState
      icon={Briefcase}
      message={NOTHING_PUBLISHED}
      action={
        signedIn ? (
          <Link to="/profile" className={buttonVariants({ variant: 'outline' })}>
            Keep your CV ready
          </Link>
        ) : (
          <Link to="/signup" className={buttonVariants()}>
            Create your profile
          </Link>
        )
      }
    />
  );
}
