import { EmptyState } from '@sync/ui/components/empty-state';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { Badge } from '@sync/ui/components/ui/badge';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Star, Users } from 'lucide-react';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { useTalentPool } from '@/features/talent-pool/hooks/use-talent-pool';
import { problemMessage } from '@/lib/api-problem';
import { candidateMeta, type MatchedCandidate, matchEvidence, matchedCard } from '../candidate';
import { useCandidateSearch } from '../hooks/use-candidate-search';
import { type CandidatesReading, candidatesAddress } from '../reading';
import { hardFilterCount, isAsked, noMatchesMessage, SEARCH_LIMIT } from '../search';
import { CandidateAvatar } from './candidate-avatar';
import { MatchEvidenceNote } from './match-evidence';

const TO_THE_POOL = (
  <Link to="/talent-pool" className={buttonVariants({ variant: 'outline' })}>
    Go to your talent pool
  </Link>
);

interface CandidateResultsProps {
  reading: CandidatesReading;
  onClear: () => void;
}

export function CandidateResults({ reading, onClear }: CandidateResultsProps) {
  const matches = useCandidateSearch(reading);
  const pool = useTalentPool();

  if (!isAsked(reading)) {
    return (
      <EmptyState
        icon={Users}
        message="Search reaches every Candidate on the platform who has opted into being found. The people you have already saved are in your talent pool."
        action={TO_THE_POOL}
      />
    );
  }

  if (matches.isError) {
    return (
      <RetryNotice
        message={problemMessage(matches.error, "Couldn't run that search.")}
        onRetry={() => void matches.refetch()}
      />
    );
  }

  if (matches.isPending) return <ListSkeleton rows={4} />;

  const items = matches.data.items;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        message={noMatchesMessage(reading)}
        action={
          hardFilterCount(reading) > 0 ? (
            <Button variant="outline" onClick={onClear}>
              Clear filters
            </Button>
          ) : (
            TO_THE_POOL
          )
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-meta text-muted-foreground">{howMany(items.length)}</p>
      <ul aria-label="Matching Candidates" className="space-y-3">
        {items.map((match) => (
          <li key={match.candidate_id}>
            <CandidateResult
              match={match}
              reading={reading}
              saved={pool.holds(match.candidate_id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function howMany(shown: number): string {
  if (shown >= SEARCH_LIMIT) {
    return `The closest ${shown}. Narrow the search to reach past them.`;
  }
  return shown === 1 ? '1 match, closest first.' : `${shown} matches, closest first.`;
}

interface CandidateResultProps {
  match: MatchedCandidate;
  reading: CandidatesReading;
  saved: boolean;
}

function CandidateResult({ match, reading, saved }: CandidateResultProps) {
  const card = matchedCard(match);
  const meta = candidateMeta(card);
  const evidence = matchEvidence(match);

  return (
    <Link
      to="/candidates/$candidateId"
      params={{ candidateId: card.id }}
      search={candidatesAddress(reading)}
      aria-label={card.fullName}
      className="block space-y-3 rounded-lg border border-border p-4 outline-none transition-colors hover:bg-interactive-hover focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <CandidateAvatar fullName={card.fullName} avatarUrl={card.avatarUrl} />
          <div className="min-w-0 space-y-1">
            <p className="text-dense font-medium text-foreground">{card.fullName}</p>
            {meta ? <p className="text-meta text-muted-foreground">{meta}</p> : null}
          </div>
        </div>
        {saved ? (
          <Badge variant="secondary" className="gap-1">
            <Star aria-hidden="true" className="size-3" />
            In your talent pool
          </Badge>
        ) : null}
      </div>

      <MatchEvidenceNote evidence={evidence} />
    </Link>
  );
}
