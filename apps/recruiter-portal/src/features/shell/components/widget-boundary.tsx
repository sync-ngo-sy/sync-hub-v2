import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { reportError } from '@/lib/report-error';
import { ErrorCard } from './error-card';

interface WidgetBoundaryProps {
  source: string;
  message?: string;
  children: ReactNode;
}

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
