import { StatusMark } from '@sync/ui/components/status-mark';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@sync/ui/components/ui/breadcrumb';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { cn } from '@sync/ui/lib/utils';
import { Link } from '@tanstack/react-router';
import { FileText, UserRound } from 'lucide-react';
import { CandidateIdentityHeader } from '@/features/profile/components/candidate-identity-header';
import { CandidateProfile } from '@/features/profile/components/candidate-profile';
import { snapshotProfile, yearsOfExperience } from '@/features/profile/profile';
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

export function ApplicationReviewPage({ applicationId }: { applicationId: string }) {
  const { data: review } = useApplication(applicationId);

  if (!review) return null;

  const verdict = screeningState(review.screening.status);
  const profile = snapshotProfile(review.snapshot, review.candidate);
  const experience =
    profile.totalExperienceYears === null
      ? null
      : `${yearsOfExperience(profile.totalExperienceYears)} experience`;

  return (
    <>
      <CandidateIdentityHeader
        profile={profile}
        contextLabel="Snapshot"
        factsLabel="Application facts"
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/jobs" search={{}} />}>Jobs</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink
                  render={
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: review.job.id }}
                      search={{ tab: 'applications' }}
                    />
                  }
                >
                  {review.job.title}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link to="/applications" search={{}} />}>
                  Applications
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{profile.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
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
              search={{}}
              className={HEADER_ACTION}
            >
              <UserRound aria-hidden="true" />
              Live candidate profile
            </Link>
          </>
        }
        facts={[
          { label: 'Location', value: profile.location },
          { label: 'Experience', value: experience },
          {
            label: 'Applied',
            value: <time dateTime={review.applied_at}>{absoluteDateTime(review.applied_at)}</time>,
          },
          {
            label: 'Last moved',
            value: <time dateTime={review.updated_at}>{absoluteDateTime(review.updated_at)}</time>,
          },
        ]}
      />

      <div className="space-y-(--space-section) pt-(--space-section)">
        <ApplicationPipeline applicationId={applicationId} status={review.status} />

        <div className="grid gap-(--space-grid) lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
          <ReviewCard title="Screening">
            <div className="space-y-3">
              <StatusMark label={verdict.label} tone={verdict.tone} />
              <p className="text-dense text-muted-foreground">
                {review.screening.reason ?? 'Screening has not run on this Application yet.'}
              </p>
            </div>
          </ReviewCard>

          <WidgetBoundary name="Tags">
            <ApplicationTags applicationId={applicationId} />
          </WidgetBoundary>

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
