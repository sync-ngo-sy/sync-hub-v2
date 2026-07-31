import type { ErrorComponentProps } from '@tanstack/react-router';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { problemMessage } from '@/lib/api-problem';
import { reportError } from '@/lib/report-error';
import { ErrorCard } from './error-card';

/** Tier three: this route failed, but the shell around it is still standing. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => reportError(error, { boundary: 'route' }), [error]);

  return (
    <ErrorCard
      title="This page didn't load"
      description={problemMessage(error, 'Something went wrong on our side.')}
      retryLabel="Try again"
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}

/** Tier three's last resort: the shell itself failed, so a full reload is the only way out. */
export function AppCrash({ error }: ErrorComponentProps) {
  useEffect(() => reportError(error, { boundary: 'app-shell' }), [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <ErrorCard
        title="Sync Recruiter didn't start"
        description={problemMessage(error, 'Something went wrong before the workspace loaded.')}
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
