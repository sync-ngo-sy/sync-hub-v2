import { Link } from '@tanstack/react-router';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { ReviewCard } from '@/features/shell/components/review-card';
import { problemMessage } from '@/lib/api-problem';
import { calendarDay } from '@/lib/dates';
import { useCandidatePlacements } from '../hooks/use-candidate-placements';

const HINT = 'Hires your team claimed and this Candidate confirmed. Yours alone.';

export function CandidatePlacementsCard({ candidateId }: { candidateId: string }) {
  const placements = useCandidatePlacements(candidateId);

  if (placements.isError) {
    return (
      <ReviewCard title="Placements" hint={HINT}>
        <RetryNotice
          message={problemMessage(
            placements.error,
            "Couldn't read your Placements of this person.",
          )}
          onRetry={() => void placements.refetch()}
        />
      </ReviewCard>
    );
  }

  const placed = placements.data ?? [];
  if (placed.length === 0) return null;

  return (
    <ReviewCard title="Placements" hint={HINT}>
      <ul aria-label="Placements of this Candidate" className="divide-y divide-border">
        {placed.map((placement) => (
          <li key={placement.application_id} className="space-y-1 py-3 first:pt-0 last:pb-0">
            <Link
              to="/jobs/$jobId"
              params={{ jobId: placement.job.id }}
              search={{}}
              className="rounded-sm text-dense font-medium text-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {placement.job.title}
            </Link>
            <p className="text-meta text-muted-foreground">
              Started{' '}
              <time dateTime={placement.start_date}>{calendarDay(placement.start_date)}</time>
            </p>
          </li>
        ))}
      </ul>
    </ReviewCard>
  );
}
