import { Button } from '@sync/ui/components/ui/button';
import { CircleAlert } from 'lucide-react';

interface RetryNoticeProps {
  message: string;
  onRetry: () => void;
}

export function RetryNotice({ message, onRetry }: RetryNoticeProps) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-2 text-dense text-muted-foreground">
        <CircleAlert aria-hidden="true" className="size-4" />
        {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
