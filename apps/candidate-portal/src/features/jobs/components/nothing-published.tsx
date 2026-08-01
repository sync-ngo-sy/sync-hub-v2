import { EmptyState } from '@sync/ui/components/empty-state';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Briefcase } from 'lucide-react';

/** The one action differs by reader: a visitor has an account to make, a Candidate a CV to keep. */
export function NothingPublished({ signedIn }: { signedIn: boolean }) {
  return (
    <EmptyState
      icon={Briefcase}
      message="No roles are open right now. New ones appear here the moment an employer publishes them."
      action={
        signedIn ? (
          <Link to="/cvs" className={buttonVariants({ variant: 'outline' })}>
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
