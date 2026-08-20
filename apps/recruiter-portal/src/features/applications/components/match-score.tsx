import { HoverCard, HoverCardContent, HoverCardTrigger } from '@sync/ui/components/ui/hover-card';
import { absoluteDateTime } from '@/lib/dates';
import { type MatchScore, matchLabel, NO_REASONS } from '../assessment';

const NOT_READ = 'Not read yet';

export function MatchScoreCell({ match }: { match: MatchScore | null | undefined }) {
  if (!match) {
    return <span className="text-muted-foreground">{NOT_READ}</span>;
  }

  const percentage = `${Math.round(match.percentage)}%`;
  return (
    <HoverCard>
      <HoverCardTrigger
        render={<button type="button" />}
        aria-label={matchLabel(match.percentage)}
        onClick={(event) => event.stopPropagation()}
        className="rounded-sm tabular-nums underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {percentage}
      </HoverCardTrigger>
      <HoverCardContent className="max-w-80 space-y-2">
        <p className="font-medium text-dense text-foreground">{matchLabel(match.percentage)}</p>
        <p className="text-dense text-muted-foreground">{match.explanation || NO_REASONS}</p>
        <p className="text-meta text-muted-foreground">
          {match.model_name} ·{' '}
          <time dateTime={match.assessed_at}>{absoluteDateTime(match.assessed_at)}</time>
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
