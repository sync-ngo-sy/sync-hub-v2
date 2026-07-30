import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { reportError } from '@/lib/report-error';
import { ErrorCard } from './error-card';

interface WidgetBoundaryProps {
  /** Names the panel in the report, e.g. "recent-applications". */
  source: string;
  message?: string;
  children: ReactNode;
}

/** Tier two: one panel fails, says so where it sits, and the rest of the page keeps working. */
export function WidgetBoundary({ source, message, children }: WidgetBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error) => reportError(error, { boundary: 'widget', source })}
      fallbackRender={({ resetErrorBoundary }) => (
        <ErrorCard message={message} onRetry={resetErrorBoundary} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
