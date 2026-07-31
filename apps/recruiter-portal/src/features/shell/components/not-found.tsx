import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-5 text-center">
      <h1 className="font-heading text-h3 text-foreground">Page not found</h1>
      <p className="text-dense text-muted-foreground">
        That address doesn't exist in Sync Recruiter.
      </p>
      <div>
        <Button variant="outline" render={<Link to="/dashboard" />}>
          Go to the Dashboard
        </Button>
      </div>
    </div>
  );
}
