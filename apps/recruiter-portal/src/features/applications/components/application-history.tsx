import { Button } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ReviewCard } from '@/features/shell/components/review-card';
import { absoluteDateTime } from '@/lib/dates';
import { historyLine, type StatusHistoryEntry } from '../review';

const AT_A_GLANCE = 6;

export function ApplicationHistory({ history }: { history: StatusHistoryEntry[] }) {
  const [showsAll, setShowsAll] = useState(false);
  const hidden = Math.max(history.length - AT_A_GLANCE, 0);
  const shown = showsAll ? history : history.slice(-AT_A_GLANCE);

  return (
    <ReviewCard title="History">
      <div className="space-y-3">
        <ol aria-label="History" className="space-y-4">
          {shown.map((entry) => {
            const line = historyLine(entry);
            return (
              <li key={`${entry.changed_at}-${entry.status}`} className="space-y-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-dense text-foreground">{line.title}</p>
                  <time dateTime={entry.changed_at} className="text-meta text-muted-foreground">
                    {absoluteDateTime(entry.changed_at)}
                  </time>
                </div>
                <p className="text-meta text-muted-foreground">{line.detail}</p>
              </li>
            );
          })}
        </ol>

        {hidden > 0 ? (
          <div className="border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showsAll}
              onClick={() => setShowsAll(!showsAll)}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              {showsAll
                ? 'Show fewer'
                : `Show ${hidden} earlier ${hidden === 1 ? 'move' : 'moves'}`}
              <ChevronDown
                aria-hidden="true"
                className={cn('transition-transform', showsAll && 'rotate-180')}
              />
            </Button>
          </div>
        ) : null}
      </div>
    </ReviewCard>
  );
}
