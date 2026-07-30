import { Button } from '@sync/ui/components/ui/button';
import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { reportError } from '@/lib/report-error';
import { ErrorCard } from './error-card';

export function RouteError({ error, reset }: ErrorComponentProps<unknown>) {
  const router = useRouter();

  useEffect(() => {
    reportError(error, { boundary: 'route' });
  }, [error]);

  return (
    <ErrorCard
      message="Couldn't load this page."
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}

export function AppCrash({ error }: ErrorComponentProps<unknown>) {
  useEffect(() => {
    reportError(error, { boundary: 'app-shell' });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-heading text-h3 text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page could not be shown. Reloading usually clears it.
      </p>
      <Button variant="outline" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </main>
  );
}
