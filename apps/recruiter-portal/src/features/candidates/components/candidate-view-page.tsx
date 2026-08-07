import { PageHeader } from '@sync/ui/components/page-header';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { useLanguages } from '@/features/reference/hooks/use-languages';
import { languageName } from '@/features/reference/options';
import { ReviewCard } from '@/features/shell/components/review-card';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { TalentPoolCard } from '@/features/talent-pool/components/talent-pool-card';
import { type CandidateCard, candidateMeta, type MatchEvidence } from '../candidate';
import { type CandidateSearchFilters, searchAddress } from '../search';
import { CandidateAvatar } from './candidate-avatar';
import { CandidateNotes } from './candidate-notes';
import { CandidateTags } from './candidate-tags';
import { MatchEvidenceNote } from './match-evidence';

const PROFILE_HINT =
  'What the platform will show you about this person. Sync never hands over an address or a phone number.';

export function CandidateOutOfReach({ filters }: { filters: CandidateSearchFilters }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <h1 className="font-heading text-h3 text-foreground">This Candidate can’t be shown</h1>
      <p className="text-dense text-muted-foreground">
        Sync reads a Candidate through the search that finds them or through your talent pool, and
        neither has them. They may have stopped being searchable since you last looked.
      </p>
      <Link
        to="/candidates"
        search={searchAddress(filters)}
        className={buttonVariants({ variant: 'outline' })}
      >
        Back to candidate search
      </Link>
    </div>
  );
}

interface CandidateViewPageProps {
  card: CandidateCard;
  evidence: MatchEvidence | null;
  filters: CandidateSearchFilters;
}

export function CandidateViewPage({ card, evidence, filters }: CandidateViewPageProps) {
  const languages = useLanguages();
  const language = languageName(languages.data, card.preferredLanguageCode);

  return (
    <div className="space-y-(--space-section)">
      <div className="space-y-4">
        <Link
          to="/candidates"
          search={searchAddress(filters)}
          className={buttonVariants({ variant: 'link', size: 'sm' })}
        >
          Back to candidate search
        </Link>
        <div className="flex items-center gap-4">
          <CandidateAvatar card={card} size="lg" />
          <PageHeader
            title={card.fullName}
            description={candidateMeta(card, language) || undefined}
          />
        </div>
      </div>

      <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        <div className="space-y-(--space-grid)">
          <ReviewCard title="Profile" hint={PROFILE_HINT}>
            <div className="space-y-4">
              <p className="whitespace-pre-wrap text-dense text-foreground">
                {card.summary ?? 'This Candidate has not written a summary.'}
              </p>

              <dl aria-label="Profile facts" className="flex flex-wrap gap-x-8 gap-y-3 text-dense">
                <div>
                  <dt className="text-meta text-muted-foreground">Location</dt>
                  <dd>{card.locationName ?? 'Not said'}</dd>
                </div>
                <div>
                  <dt className="text-meta text-muted-foreground">Preferred language</dt>
                  <dd>{language ?? 'Not said'}</dd>
                </div>
              </dl>

              <MatchEvidenceNote evidence={evidence} />
            </div>
          </ReviewCard>

          <WidgetBoundary name="Notes">
            <CandidateNotes candidateId={card.id} />
          </WidgetBoundary>
        </div>

        <div className="space-y-(--space-grid)">
          <WidgetBoundary name="Talent pool">
            <TalentPoolCard candidateId={card.id} candidateName={card.fullName} />
          </WidgetBoundary>

          <WidgetBoundary name="Tags">
            <CandidateTags candidateId={card.id} />
          </WidgetBoundary>
        </div>
      </div>
    </div>
  );
}
