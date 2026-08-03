import { EmptyState } from '@sync/ui/components/empty-state';
import { ListSkeleton } from '@sync/ui/components/skeletons';
import { StatusChip } from '@sync/ui/components/status-chip';
import { Button, buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageName } from '@/features/reference/options';
import { RetryNotice } from '@/features/shell/components/retry-notice';
import { useTalentPool } from '@/features/talent-pool/hooks/use-talent-pool';
import { problemMessage } from '@/lib/api-problem';
import { candidateMeta, type MatchedCandidate, matchEvidence, matchedCard } from '../candidate';
import { useCandidateSearch } from '../hooks/use-candidate-search';
import {
  type CandidateSearchFilters,
  hardFilterCount,
  isAsked,
  noMatchesMessage,
  searchAddress,
} from '../search';

const TO_THE_POOL = (
  <Link to="/talent-pool" className={buttonVariants({ variant: 'outline' })}>
    Go to your talent pool
  </Link>
);

interface CandidateResultsProps {
  filters: CandidateSearchFilters;
  onClear: () => void;
}

export function CandidateResults({ filters, onClear }: CandidateResultsProps) {
  const matches = useCandidateSearch(filters);
  const languages = useLanguages();
  const pool = useTalentPool();

  if (!isAsked(filters)) {
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
        message={noMatchesMessage(filters)}
        action={
          hardFilterCount(filters) > 0 ? (
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
      <p className="text-meta text-muted-foreground">
        {items.length === 1 ? '1 match, closest first.' : `${items.length} matches, closest first.`}
      </p>
      <ul aria-label="Matching Candidates" className="space-y-3">
        {items.map((match) => (
          <li key={match.candidate_id}>
            <CandidateResult
              match={match}
              filters={filters}
              languageName={languageName(languages.data, match.preferred_language_code)}
              saved={pool.holds(match.candidate_id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CandidateResultProps {
  match: MatchedCandidate;
  filters: CandidateSearchFilters;
  languageName: string | null;
  saved: boolean;
}

function CandidateResult({ match, filters, languageName, saved }: CandidateResultProps) {
  const card = matchedCard(match);
  const meta = candidateMeta(card, languageName);
  const evidence = matchEvidence(match);

  return (
    <Link
      to="/candidates/$candidateId"
      params={{ candidateId: card.id }}
      search={searchAddress(filters)}
      aria-label={card.fullName}
      className="block space-y-3 rounded-lg border border-border p-4 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="space-y-1">
          <p className="text-dense font-medium text-foreground">{card.fullName}</p>
          {meta ? <p className="text-meta text-muted-foreground">{meta}</p> : null}
        </div>
        {saved ? <StatusChip tone="positive" label="In your talent pool" /> : null}
      </div>

      {evidence ? (
        <figure className="space-y-1 border-s-2 border-border ps-3">
          <blockquote className="text-dense text-muted-foreground">{evidence.text}</blockquote>
          <figcaption className="text-meta text-muted-foreground">{evidence.where}</figcaption>
        </figure>
      ) : null}
    </Link>
  );
}
