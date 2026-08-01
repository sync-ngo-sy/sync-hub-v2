import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { SearchX } from 'lucide-react';

/** A closed role and a dead link are the same dead end, so both get the same one way out. */
function Gone({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <SearchX aria-hidden="true" className="size-6 text-muted-foreground" />
      <h1 className="font-heading text-h3 text-foreground">{title}</h1>
      <p className="max-w-sm text-dense text-muted-foreground">{description}</p>
      <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
        Browse jobs
      </Link>
    </div>
  );
}

export function ClosedJob() {
  return (
    <Gone
      title="This role isn't open"
      description="It may have been filled, or closed by the employer. Everything still open is one tap away."
    />
  );
}

export function DeadTrackedLink() {
  return (
    <Gone
      title="This link didn't work"
      description="Links stop working when the role closes or the employer switches the link off. The rest of the board is still here."
    />
  );
}
