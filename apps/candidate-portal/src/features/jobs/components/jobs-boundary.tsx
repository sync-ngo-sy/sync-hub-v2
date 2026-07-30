import { QueryErrorResetBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { WidgetErrorBoundary } from '../../../components/widget-error-boundary';

/**
 * Routes a failed Job query into the shared widget boundary — so the failure is reported and
 * Retry refetches it. A 404 never reaches here: the hooks keep it out of the boundary so it can
 * render as a friendly not-found instead.
 */
export function JobsBoundary({
  children,
  context,
}: {
  children: ReactNode;
  context?: Record<string, unknown>;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <WidgetErrorBoundary context={context} onReset={reset}>
          {children}
        </WidgetErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
