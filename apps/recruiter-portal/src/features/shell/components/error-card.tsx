import { Button } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { TriangleAlert } from 'lucide-react';

interface ErrorCardProps {
  /** What failed, in the user's terms — "Couldn't load this job", not a stack frame. */
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** The middle error tier: the panel that failed says so in place, and offers a way back. */
export function ErrorCard({
  message = "Couldn't load this section.",
  onRetry,
  className,
}: ErrorCardProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5',
        className,
      )}
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
