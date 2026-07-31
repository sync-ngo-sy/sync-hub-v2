import { Button } from '@sync/ui/components/ui/button';
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/goodbye')({
  component: GoodbyePage,
});

function GoodbyePage() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-h2 font-heading text-foreground">Your account is deleted</h1>
      <p className="text-muted-foreground">
        Your profile is gone and you've been signed out. Thank you for having been part of Sync — we
        hope your search led somewhere good.
      </p>
      <Button
        variant="outline"
        render={
          <Link to="/" className="mt-2">
            Back to Sync
          </Link>
        }
      />
    </div>
  );
}
