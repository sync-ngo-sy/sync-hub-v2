import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { reportError } from '../lib/report-error';

function WidgetFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle aria-hidden className="size-4" />
          Couldn't load
        </span>
        <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function WidgetErrorBoundary({
  children,
  context,
}: {
  children: ReactNode;
  context?: Record<string, unknown>;
}) {
  return (
    <ErrorBoundary
      FallbackComponent={WidgetFallback}
      onError={(error) => reportError(error, { boundary: 'widget', ...context })}
    >
      {children}
    </ErrorBoundary>
  );
}
