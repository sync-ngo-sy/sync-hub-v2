import { QueryErrorResetBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { reportError } from '@/lib/report-error';
import { ErrorCard } from './error-card';

export function WidgetBoundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onError={(error) => reportError(error, { boundary: 'widget', source: name })}
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <ErrorCard
              title="Couldn't load this"
              description={`${name} didn't load. The rest of the page is fine.`}
              onRetry={resetErrorBoundary}
            />
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
