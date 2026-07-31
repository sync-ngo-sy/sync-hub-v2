import { Button } from '@sync/ui/components/ui/button';
import { Card, CardContent } from '@sync/ui/components/ui/card';
import { CircleAlert } from 'lucide-react';

interface ErrorCardProps {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** The one recoverable-failure shape: what broke, and one way out. Never a white screen. */
export function ErrorCard({ title, description, onRetry, retryLabel = 'Retry' }: ErrorCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-4.5 text-muted-foreground" />
          <p className="font-medium text-foreground">{title}</p>
        </div>
        <p className="text-dense text-muted-foreground">{description}</p>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
