import type { components } from '@sync/api-client';
import { http } from '@sync/api-client/testing';
import type { ApplicationSummary } from '@/features/applications/application';
import { holding } from '@/testing/holding';

type Problem = components['schemas']['ProblemDetail'];

const PATH = '/v1/tenants/me/jobs/{job_id}/applications';

export interface JobApplicationsFixture {
  items: ApplicationSummary[];
  next_cursor?: string | null;
}

/** The Dashboard reads one page per Job, so its handler answers per Job id rather than per call.
 * A Job the map does not name has had no applicants. */
export function listsApplicationsPerJob(pages: Record<string, JobApplicationsFixture>) {
  return [
    http.get(PATH, ({ params, response }) => {
      const page = pages[params.job_id];
      return response(200).json({
        items: page?.items ?? [],
        next_cursor: page?.next_cursor ?? null,
      });
    }),
  ];
}

/** One Job's page refuses while the others answer, which is how a partly-read Dashboard looks. */
export function failsOneJobsApplications(
  jobId: string,
  pages: Record<string, JobApplicationsFixture>,
  problem: Problem,
) {
  return [
    http.get(PATH, ({ params, response }) => {
      if (params.job_id === jobId) return response(500).json(problem);
      const page = pages[params.job_id];
      return response(200).json({
        items: page?.items ?? [],
        next_cursor: page?.next_cursor ?? null,
      });
    }),
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
        const page = pages[params.job_id];
        return response(200).json({
          items: page?.items ?? [],
          next_cursor: page?.next_cursor ?? null,
        });
      }),
    ],
  };
}
