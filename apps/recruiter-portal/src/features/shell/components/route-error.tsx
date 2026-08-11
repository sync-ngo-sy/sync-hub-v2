import { type ErrorComponentProps, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { problemMessage } from '@/lib/api-problem';
import { reportError } from '@/lib/report-error';
import { CenteredScreen } from './centered-screen';
import { ErrorCard } from './error-card';

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

export function AppCrash({ error }: ErrorComponentProps) {
  useEffect(() => reportError(error, { boundary: 'app-shell' }), [error]);

  return (
    <CenteredScreen>
      <ErrorCard
        title="Sync Hub Recruiter didn't start"
        description={problemMessage(error, 'Something went wrong before the workspace loaded.')}
        retryLabel="Reload"
        onRetry={() => window.location.reload()}
      />
    </CenteredScreen>
  );
}
