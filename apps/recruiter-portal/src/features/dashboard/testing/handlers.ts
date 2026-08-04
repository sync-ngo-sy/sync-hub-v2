import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import type { ApplicationSummary } from '@/features/applications/application';
import { holding } from '@/testing/holding';

type Problem = components['schemas']['ProblemDetail'];
type ApplicationSummaryPage = components['schemas']['ApplicationSummaryPage'];

const PATH = '/v1/tenants/me/jobs/{job_id}/applications';

export interface JobApplicationsFixture {
  items: ApplicationSummary[];
  next_cursor?: string | null;
}

/** A Job the map does not name has had no applicants. */
function pageFor(
  pages: Record<string, JobApplicationsFixture>,
  jobId: string,
): ApplicationSummaryPage {
  const page = pages[jobId];
  return { items: page?.items ?? [], next_cursor: page?.next_cursor ?? null };
}

/** The Dashboard reads one page per Job, so its handler answers per Job id rather than per call. */
export function listsApplicationsPerJob(pages: Record<string, JobApplicationsFixture>) {
  return [
    http.get(PATH, ({ params, response }) => response(200).json(pageFor(pages, params.job_id))),
  ];
}

/** One Job's page refuses while the others answer, which is how a partly-read Dashboard looks. */
export function failsOneJobsApplications(
  jobId: string,
  pages: Record<string, JobApplicationsFixture>,
  problem: Problem,
) {
  return [
    http.get(PATH, ({ params, response }) =>
      params.job_id === jobId
        ? response(500).json(problem)
        : response(200).json(pageFor(pages, params.job_id)),
    ),
  ];
}

/** Holds every Job's page until the caller lets it arrive, so a test can see the skeletons. */
export function holdsApplicationsPerJob(pages: Record<string, JobApplicationsFixture>) {
  const gate = holding();
  return {
    arrive: gate.arrive,
    handlers: [
      http.get(PATH, async ({ params, response }) => {
        await gate.held;
        return response(200).json(pageFor(pages, params.job_id));
      }),
    ],
  };
}
