import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { CenteredScreen } from './centered-screen';

export function NotFound() {
  return (
    <CenteredScreen>
      <h1 className="font-heading text-h3 text-foreground">Page not found</h1>
      <p className="text-dense text-muted-foreground">
        That address doesn't exist in Sync Recruiter.
      </p>
      <div>
        <Button variant="outline" render={<Link to="/dashboard" />}>
          Go to the Dashboard
        </Button>
      </div>
    </CenteredScreen>
  );
}
