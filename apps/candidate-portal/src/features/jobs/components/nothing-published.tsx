import { EmptyState } from '@sync/ui/components/empty-state';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';
import { NOTHING_PUBLISHED } from '../job';

/** The one action differs by reader: a visitor has an account to make, a Candidate a CV to keep. */
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
