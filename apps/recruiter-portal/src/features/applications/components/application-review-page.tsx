import { StatusMark } from '@sync/ui/components/status-mark';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { FileText, UserRound } from 'lucide-react';
import {
  CandidateFactsCard,
  CandidateProfile,
} from '@/features/profile/components/candidate-profile';
import { snapshotProfile } from '@/features/profile/profile';
import { ReviewCard } from '@/features/shell/components/review-card';
import { WidgetBoundary } from '@/features/shell/components/widget-boundary';
import { absoluteDateTime } from '@/lib/dates';
import { screeningState } from '../application';
import { useApplication } from '../hooks/use-application';
import { ApplicantMessage } from './applicant-message';
import { ApplicationAnswers } from './application-answers';
import { ApplicationHistory } from './application-history';
import { ApplicationNotes } from './application-notes';
import { ApplicationPipeline } from './application-pipeline';
import { ApplicationTags } from './application-tags';
import { MatchAssessments } from './match-assessments';

const SNAPSHOT_HINT =
  'What the candidate reviewed when they applied — not their profile as it stands today.';

const CARD_MARK = 'Snapshot';

const CARD_NOTE =
  'Who they were when they applied, not who they are today. Only the email and the photo are ' +
  'read live — everything else here was frozen with the Application.';

const SNAPSHOT_EMPTY = 'Nothing else was on the profile when this Application was sent.';

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

export function ApplicationReviewPage({ applicationId }: { applicationId: string }) {
  const { data: review } = useApplication(applicationId);

  if (!review) return null;

  const verdict = screeningState(review.screening.status);
  const profile = snapshotProfile(review.snapshot, review.candidate);

  return (
    <div className="space-y-(--space-section)">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/jobs/$jobId"
            params={{ jobId: review.job.id }}
            className={buttonVariants({ variant: 'link', size: 'sm' })}
          >
            Back to {review.job.title}
          </Link>
          <Link
            to="/candidates/$candidateId"
            params={{ candidateId: review.candidate.id }}
            search={{}}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <UserRound aria-hidden="true" />
            Open the full profile
          </Link>
        </div>
        <CandidateFactsCard profile={profile} contextLabel={CARD_MARK} note={CARD_NOTE} />
        <dl
          aria-label="Application facts"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-dense"
        >
          <div>
            <dt className="text-meta text-muted-foreground">Applied</dt>
            <dd>{absoluteDateTime(review.applied_at)}</dd>
          </div>
          <div>
            <dt className="text-meta text-muted-foreground">Last moved</dt>
            <dd>{absoluteDateTime(review.updated_at)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        <div className="space-y-(--space-grid)">
          <CandidateProfile
            profile={profile}
            title="Snapshot"
            hint={SNAPSHOT_HINT}
            empty={SNAPSHOT_EMPTY}
          />
          <ApplicationAnswers answers={review.answers} />
          <WidgetBoundary name="Match assessment">
            <MatchAssessments applicationId={applicationId} />
          </WidgetBoundary>

          <WidgetBoundary name="Notes">
            <ApplicationNotes applicationId={applicationId} />
          </WidgetBoundary>
        </div>

        <div className="space-y-(--space-grid)">
          <ApplicationPipeline applicationId={applicationId} status={review.status} />

          <ReviewCard title="CV" icon={FileText}>
            <div className="space-y-2">
              <a
                href={review.cv.download_url}
                target="_blank"
                rel="noreferrer"
                className="text-dense underline underline-offset-4"
              >
                {review.cv.display_name}
              </a>
              <p className="text-meta text-muted-foreground">
                This link is short-lived — reload the page if it stops working.
              </p>
            </div>
          </ReviewCard>

          <WidgetBoundary name="Tags">
            <ApplicationTags applicationId={applicationId} />
          </WidgetBoundary>

          <WidgetBoundary name="Message the applicant">
            <ApplicantMessage
              applicationId={applicationId}
              candidateName={review.snapshot.full_name}
              jobTitle={review.job.title}
            />
          </WidgetBoundary>

          <ReviewCard title="Screening">
            <div className="space-y-3">
              <StatusMark label={verdict.label} tone={verdict.tone} />
              <p className="text-dense text-muted-foreground">
                {review.screening.reason ?? 'Screening has not run on this Application yet.'}
              </p>
            </div>
          </ReviewCard>

          <ApplicationHistory history={review.history} />
        </div>
      </div>
    </div>
  );
}
