import type { components } from '@sync/api-client';
import type { ApplicationSummary } from '@/features/applications/application';
import type { JobSummary } from '@/features/jobs/job';

type JobPage = components['schemas']['JobPage'];
type ApplicationSummaryPage = components['schemas']['ApplicationSummaryPage'];

/** How many published Jobs the dashboard reads Applications for. The API has no tenant-wide
 * Application list, so the counts are a fan-out over first pages (§10 of the design document)
 * and the fan-out is bounded — the page says so rather than pretending otherwise. */
export const DASHBOARD_JOBS = 6;

/** How many Applications the dashboard asks each of those Jobs for. */
export const DASHBOARD_APPLICATIONS = 20;

export const RECENT_APPLICATIONS = 6;
export const OVERVIEW_JOBS = 5;

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** One Job's newest Applications, as the dashboard read them. */
export interface JobApplications {
  job: JobSummary;
  page: ApplicationSummaryPage;
}

/** A number read off first pages: `atLeast` says the tenant's real total is higher than this. */
export interface Count {
  value: number;
  atLeast: boolean;
}

/** An Application and the Job it went to — the summary alone does not name its Job. */
export interface RecentApplication {
  application: ApplicationSummary;
  job: JobSummary;
}

export interface JobsRead {
  /** Published Jobs: the ones candidates can apply to today. */
  open: Count;
  draft: number;
  /** The newest Jobs whatever their state, as the overview panel lists them. */
  overview: JobSummary[];
  /** The published Jobs whose Applications the dashboard goes on to read. */
  toCount: JobSummary[];
  /** Whether `toCount` is every published Job the tenant has, which is what makes the
   * Application counts exact rather than floors. */
  everyJob: boolean;
}

export function readJobs(page: JobPage): JobsRead {
  const published = page.items.filter((job) => job.status === 'published');
  const toCount = published.slice(0, DASHBOARD_JOBS);
  const unread = page.next_cursor !== null && page.next_cursor !== undefined;

  return {
    open: { value: published.length, atLeast: unread },
    draft: page.items.filter((job) => job.status === 'draft').length,
    overview: page.items.slice(0, OVERVIEW_JOBS),
    toCount,
    everyJob: !unread && toCount.length === published.length,
  };
}

export interface ApplicationsRead {
  recent: RecentApplication[];
  thisWeek: Count;
  /** Of `thisWeek`, how many arrived in the last twenty-four hours. */
  today: number;
  awaitingReview: Count;
  qualified: Count;
  /** Of the verdicts Screening has actually decided, the percentage it passed. Null when it
   * has decided none of them, because a rate over nothing says nothing. */
  passRate: number | null;
  /** How many Applications every count above was read from. */
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
  const since = (span: number) =>
    all.filter(
      ({ application }) => now.getTime() - new Date(application.applied_at).getTime() < span,
    );

  const qualified = all.filter(
    ({ application }) => application.qualification_status === 'qualified',
  ).length;
  const disqualified = all.filter(
    ({ application }) => application.qualification_status === 'disqualified',
  ).length;
  const decided = qualified + disqualified;

  return {
    recent: [...all]
      .sort((one, other) => other.application.applied_at.localeCompare(one.application.applied_at))
      .slice(0, RECENT_APPLICATIONS),
    thisWeek: { value: since(WEEK).length, atLeast: truncated },
    today: since(DAY).length,
    // `new` alone: an Application nobody has picked up yet. One already `reviewing` is being
    // read by a teammate, so counting it as waiting would ask for the same work twice.
    awaitingReview: {
      value: all.filter(({ application }) => application.status === 'new').length,
      atLeast: truncated,
    },
    qualified: { value: qualified, atLeast: truncated },
    passRate: decided === 0 ? null : Math.round((qualified / decided) * 100),
    counted: all.length,
  };
}
