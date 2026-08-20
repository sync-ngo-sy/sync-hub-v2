import { StatusMark } from '@sync/ui/components/status-mark';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { FileText, UserRound } from 'lucide-react';
import { CandidatePageHeader } from '@/features/profile/components/candidate-page-header';
import {
  CandidateFactsCard,
  CandidateProfile,
} from '@/features/profile/components/candidate-profile';
import { snapshotProfile, yearsOfExperience } from '@/features/profile/profile';
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs';
import { ReviewCard } from '@/features/shell/components/review-card';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { applicationTrail, type Origin, originAddress } from '@/features/shell/origin';
import { absoluteDateTime } from '@/lib/dates';
import { screeningExplanation, screeningState } from '../application';
import { useApplication } from '../hooks/use-application';
import type { TenantApplicationFilters } from '../reading';
import { ApplicantMessage } from './applicant-message';
import { ApplicationAnswers } from './application-answers';
import { ApplicationHistory } from './application-history';
import { ApplicationNotes } from './application-notes';
import { ApplicationPipeline } from './application-pipeline';
import { ApplicationTags } from './application-tags';
import { MatchAssessmentCard } from './match-assessment';

const SNAPSHOT_HINT =
  'What the candidate reviewed when they applied — not their profile as it stands today.';

const SNAPSHOT_EMPTY = 'Nothing else was on the profile when this Application was sent.';

const HEADER_ACTION = cn(
  buttonVariants({ variant: 'outline', size: 'sm' }),
  'border-input bg-input-background hover:bg-muted',
);

export function ApplicationNotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <h1 className="font-heading text-h3 text-foreground">Application not found</h1>
      <p className="text-dense text-muted-foreground">
        This Application may belong to another workspace, or the address may be wrong.
      </p>
      <Link to="/jobs" className={buttonVariants({ variant: 'outline' })}>
        Back to Jobs
      </Link>
    </div>
  );
}

interface ApplicationReviewPageProps {
  applicationId: string;
  origin: Origin | null;
  reading: TenantApplicationFilters;
}

export function ApplicationReviewPage({
  applicationId,
  origin,
  reading,
}: ApplicationReviewPageProps) {
  const { data: review } = useApplication(applicationId);

  if (!review) return null;

  const verdict = screeningState(review.screening.status);
  const explanation = screeningExplanation(review.screening);
  const profile = snapshotProfile(review.snapshot, review.candidate);
  const experience =
    profile.totalExperienceYears === null
      ? null
      : `${yearsOfExperience(profile.totalExperienceYears)} experience`;

  return (
    <>
      <CandidatePageHeader
        name={profile.name}
        contextLabel="Snapshot"
        breadcrumbs={
          <PageBreadcrumbs
            trail={applicationTrail(origin, { name: profile.name, job: review.job, reading })}
          />
        }
        actions={
          <>
            <a
              href={review.cv.download_url}
              target="_blank"
              rel="noreferrer"
              className={HEADER_ACTION}
            >
              <FileText aria-hidden="true" />
              Open CV
            </a>
            <Link
              to="/candidates/$candidateId"
              params={{ candidateId: review.candidate.id }}
              search={{ from: originAddress({ at: 'application', applicationId }) }}
              className={HEADER_ACTION}
            >
              <UserRound aria-hidden="true" />
              Live candidate profile
            </Link>
          </>
        }
      />

      <div className="pt-(--space-section)">
        <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
          <div className="space-y-(--space-grid)">
            <CandidateFactsCard
              profile={profile}
              factsLabel="Application facts"
              facts={[
                {
                  label: 'Applied for',
                  value: (
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: review.job.id }}
                      search={{ tab: 'applications' as const }}
                      className="hover:text-primary hover:underline"
                    >
                      {review.job.title}
                    </Link>
                  ),
                },
                { label: 'Location', value: profile.location ?? 'Not provided' },
                { label: 'Experience', value: experience ?? 'Not provided' },
                {
                  label: 'Applied',
                  value: (
                    <time dateTime={review.applied_at}>{absoluteDateTime(review.applied_at)}</time>
                  ),
                },
                {
                  label: 'Last moved',
                  value: (
                    <time dateTime={review.updated_at}>{absoluteDateTime(review.updated_at)}</time>
                  ),
                },
              ]}
            />

            <ApplicationPipeline
              applicationId={applicationId}
              status={review.status}
              hire={review.hire ?? null}
            />

            <ReviewCard title="Screening">
              <div className="space-y-3">
                <StatusMark label={verdict.label} tone={verdict.tone} />
                {explanation ? (
                  <p className="text-dense text-muted-foreground">{explanation}</p>
                ) : null}
              </div>
            </ReviewCard>

            <CandidateProfile
              profile={profile}
              title="Snapshot"
              hint={SNAPSHOT_HINT}
              empty={SNAPSHOT_EMPTY}
            />
            <ApplicationAnswers answers={review.answers} />
            <WidgetBoundary name="Match assessment">
              <MatchAssessmentCard applicationId={applicationId} />
            </WidgetBoundary>
          </div>

          <div className="space-y-(--space-grid)">
            <WidgetBoundary name="Tags">
              <ApplicationTags applicationId={applicationId} />
            </WidgetBoundary>

            <WidgetBoundary name="Notes">
              <ApplicationNotes applicationId={applicationId} />
            </WidgetBoundary>

            <WidgetBoundary name="Message the applicant">
              <ApplicantMessage
                applicationId={applicationId}
                candidateName={review.snapshot.full_name}
                jobTitle={review.job.title}
              />
            </WidgetBoundary>

            <ApplicationHistory history={review.history} />
          </div>
        </div>
      </div>
    </>
  );
}
