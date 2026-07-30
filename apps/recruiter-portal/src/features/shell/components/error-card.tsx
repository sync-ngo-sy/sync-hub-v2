import { Button } from '@sync/ui/components/ui/button';
import { TriangleAlert } from 'lucide-react';

interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({ message = "Couldn't load this section.", onRetry }: ErrorCardProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5"
    >
      <TriangleAlert aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm text-foreground">{message}</span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
