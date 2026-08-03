import { PageHeader } from '@sync/ui/components/page-header';
import { StatusChip } from '@sync/ui/components/status-chip';
import { buttonVariants } from '@sync/ui/components/ui/button';
import { Link } from '@tanstack/react-router';
import { absoluteDateTime } from '@/lib/dates';
import { screeningState } from '../application';
import { useApplication } from '../hooks/use-application';
import { ApplicationAnswers } from './application-answers';
import { ApplicationHistory } from './application-history';
import { ApplicationPipeline } from './application-pipeline';
import { ApplicationSnapshot } from './application-snapshot';
import { ReviewCard } from './review-card';

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

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          to="/jobs/$jobId"
          params={{ jobId: review.job.id }}
          className={buttonVariants({ variant: 'link', size: 'sm' })}
        >
          Back to {review.job.title}
        </Link>
        <PageHeader
          title={review.snapshot.full_name}
          description={review.snapshot.headline ?? undefined}
        />
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        <div className="space-y-6">
          <ApplicationSnapshot snapshot={review.snapshot} />
          <ApplicationAnswers answers={review.answers} />
        </div>

        <div className="space-y-6">
          <ApplicationPipeline applicationId={applicationId} status={review.status} />

          <ReviewCard title="Screening">
            <div className="space-y-3">
              <StatusChip label={verdict.label} tone={verdict.tone} />
              <p className="text-dense text-muted-foreground">
                {review.screening.reason ?? 'Screening has not run on this Application yet.'}
              </p>
            </div>
          </ReviewCard>

          <ReviewCard title="CV">
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

          <ApplicationHistory history={review.history} />
        </div>
      </div>
    </div>
  );
}
