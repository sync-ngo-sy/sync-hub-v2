import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { CandidateProfile, ProfileCard } from '@/features/profile/components/candidate-profile';
import { recordProfile } from '@/features/profile/profile';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { TalentPoolCard } from '@/features/talent-pool/components/talent-pool-card';
import type { MatchEvidence } from '../candidate';
import type { CandidateRecord } from '../candidate-record';
import { type CandidateSearchFilters, searchAddress } from '../search';
import { CandidateNotes } from './candidate-notes';
import { CandidateTags } from './candidate-tags';
import { MatchEvidenceNote } from './match-evidence';

const PROFILE_EMPTY = 'This Candidate has filled in nothing beyond the facts above.';

export function CandidateOutOfReach({ filters }: { filters: CandidateSearchFilters }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <h1 className="font-heading text-h3 text-foreground">This Candidate can’t be shown</h1>
      <p className="text-dense text-muted-foreground">
        No Candidate your Workspace can reach has that id. They may have stopped being searchable
        since you last looked.
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
  record: CandidateRecord;
  evidence: MatchEvidence | null;
  filters: CandidateSearchFilters;
}

export function CandidateViewPage({ record, evidence, filters }: CandidateViewPageProps) {
  const profile = recordProfile(record);

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
        <ProfileCard profile={profile} />
      </div>

      <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        <div className="space-y-(--space-grid)">
          <CandidateProfile profile={profile} title="Profile" empty={PROFILE_EMPTY}>
            <MatchEvidenceNote evidence={evidence} />
          </CandidateProfile>

          <WidgetBoundary name="Notes">
            <CandidateNotes candidateId={record.candidate_id} />
          </WidgetBoundary>
        </div>

        <div className="space-y-(--space-grid)">
          <WidgetBoundary name="Talent pool">
            <TalentPoolCard candidateId={record.candidate_id} candidateName={profile.name} />
          </WidgetBoundary>

          <WidgetBoundary name="Tags">
            <CandidateTags candidateId={record.candidate_id} />
          </WidgetBoundary>
        </div>
      </div>
    </div>
  );
}
