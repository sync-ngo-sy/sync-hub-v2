import { HoverCard, HoverCardContent, HoverCardTrigger } from '@sync/ui/components/ui/hover-card';
import { absoluteDateTime } from '@/lib/dates';
import { matchLabel, type MatchScore as Reading } from '../assessment';

const NOT_READ = 'Not read yet';

const NO_REASONS = 'The model gave no reasons for this reading.';

/** A number nobody can check is a number nobody should act on, so the score is never on its
 * own: pointing at it or tabbing to it opens what the model said. Both, because a Recruiter
 * working a triage list by keyboard is not a worse-served Recruiter — Base UI's preview card
 * opens on hover and on focus alike.
 *
 * Deliberately plain text rather than a Status Mark: the row already carries the Screening
 * verdict, and a second coloured state beside it would read as a second verdict. Touch has no
 * hover at all, which is why the whole reading also lives on the Application review. */
export function MatchScoreCell({ match }: { match: Reading | null | undefined }) {
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
