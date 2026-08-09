import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { CenteredScreen } from './centered-screen';

export function NotFound() {
  return (
    <CenteredScreen>
      <h1 className="font-heading text-h3 text-foreground">Page not found</h1>
      <p className="text-muted-foreground">That address doesn't exist on Sync Hub.</p>
      <div>
        <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
          Browse jobs
        </Link>
      </div>
    </CenteredScreen>
  );
}
