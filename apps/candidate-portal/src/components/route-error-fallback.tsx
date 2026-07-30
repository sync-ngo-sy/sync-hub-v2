import { Button } from '@sync/ui/components/ui/button';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';

export function RouteErrorFallback({ reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertCircle aria-hidden className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-heading text-base font-medium text-foreground">
          Couldn't load this page
        </p>
        <p className="text-sm text-muted-foreground">Something went wrong. You can try again.</p>
      </div>
      <Button onClick={() => reset()}>Retry</Button>
    </div>
  );
}
