import type { components } from '@sync/api-client';
import type { ApplicationSummary } from '@/features/applications/application';
import type { JobSummary } from '@/features/jobs/job';

type JobPage = components['schemas']['JobPage'];
type ApplicationSummaryPage = components['schemas']['ApplicationSummaryPage'];

export const FAN_OUT_JOBS = 6;
export const APPLICATIONS_PER_JOB = 20;
export const RECENT_APPLICATIONS = 6;
export const OVERVIEW_JOBS = 5;

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

export interface JobApplications {
  job: JobSummary;
  page: ApplicationSummaryPage;
}

export interface Count {
  value: number;
  atLeast: boolean;
}

export function figure(count: Count | undefined): string {
  return count ? `${count.value}${count.atLeast ? '+' : ''}` : '—';
}

export interface RecentApplication {
  application: ApplicationSummary;
  job: JobSummary;
}

export interface JobsRead {
  open: Count;
  draft: Count;
  overview: JobSummary[];
  toCount: JobSummary[];
  everyJob: boolean;
}

export function readJobs(page: JobPage): JobsRead {
  const published = page.items.filter((job) => job.status === 'published');
  const toCount = published.slice(0, FAN_OUT_JOBS);
  const unread = page.next_cursor !== null && page.next_cursor !== undefined;

  return {
    open: { value: published.length, atLeast: unread },
    draft: {
      value: page.items.filter((job) => job.status === 'draft').length,
      atLeast: unread,
    },
    overview: page.items.slice(0, OVERVIEW_JOBS),
    toCount,
    everyJob: !unread && toCount.length === published.length,
  };
}

export interface ApplicationsRead {
  recent: RecentApplication[];
  thisWeek: Count;
  today: Count;
  awaitingReview: Count;
  qualified: Count;
  /** Null when Screening has decided nothing: a rate over nothing says nothing. */
  passRate: number | null;
  byJob: Record<string, Count>;
  counted: number;
}

export function readApplications(
  read: JobApplications[],
  { now, everyJob }: { now: Date; everyJob: boolean },
): ApplicationsRead {
  const all = read.flatMap(({ job, page }) =>
    page.items.map((application) => ({ application, job })),
  );
  const truncated = !everyJob || read.some(({ page }) => Boolean(page.next_cursor));
  const floor = (value: number): Count => ({ value, atLeast: truncated });
  const since = (span: number) =>
    all.filter(
      ({ application }) => now.getTime() - new Date(application.applied_at).getTime() < span,
    );
  const verdicts = (verdict: ApplicationSummary['qualification_status']) =>
    all.filter(({ application }) => application.qualification_status === verdict).length;

  const qualified = verdicts('qualified');
  const decided = qualified + verdicts('disqualified');

  return {
    recent: [...all]
      .sort((one, other) => other.application.applied_at.localeCompare(one.application.applied_at))
      .slice(0, RECENT_APPLICATIONS),
    thisWeek: floor(since(WEEK).length),
    today: floor(since(DAY).length),
    // An Application nobody has picked up: one already `reviewing` is a teammate's work in hand.
    awaitingReview: floor(all.filter(({ application }) => application.status === 'new').length),
    qualified: floor(qualified),
    passRate: decided === 0 ? null : Math.round((qualified / decided) * 100),
    byJob: Object.fromEntries(
      read.map(({ job, page }) => [
        job.id,
        { value: page.items.length, atLeast: Boolean(page.next_cursor) },
      ]),
    ),
    counted: all.length,
  };
}
