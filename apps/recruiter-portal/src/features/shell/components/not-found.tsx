import { EmptyState } from '@sync/ui/components/empty-state';
import { Button } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Compass } from 'lucide-react';

export function NotFound() {
  return (
    <EmptyState
      className="mx-auto w-full max-w-lg"
      icon={<Compass />}
      title="Page not found"
      description="That address does not match anything in this workspace."
      action={
        <Button variant="outline" render={<Link to="/dashboard" />}>
          Go to the Dashboard
        </Button>
      }
    />
  );
}
