import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { reportError } from '@/lib/report-error';
import { ErrorCard } from './error-card';

/**
 * Tier two of three: one panel fails, the rest of the page survives, and the reader gets
 * a Retry that re-mounts only what broke.
 */
export function WidgetBoundary({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error) => reportError(error, { boundary: 'widget', source: name })}
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
  );
}
