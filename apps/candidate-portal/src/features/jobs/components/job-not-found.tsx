import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';

export function JobNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <SearchX aria-hidden className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-h2 font-heading text-foreground">This job isn't available</h1>
        <p className="text-muted-foreground">
          The link may be old, or the role has closed. Plenty of others are open.
        </p>
      </div>
      <Button render={<Link to="/jobs">Browse all jobs</Link>} />
    </div>
  );
}
