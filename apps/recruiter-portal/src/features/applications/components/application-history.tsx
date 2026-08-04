import { ReviewCard } from '@/features/shell/components/review-card';
import { absoluteDateTime } from '@/lib/dates';
import { historyLine, type StatusHistoryEntry } from '../review';

export function ApplicationHistory({ history }: { history: StatusHistoryEntry[] }) {
  return (
    <ReviewCard title="History">
      <ol aria-label="History" className="space-y-4">
        {history.map((entry) => {
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
    </ReviewCard>
  );
}
