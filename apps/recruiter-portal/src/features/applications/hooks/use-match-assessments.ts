import { api } from '@/lib/api';

export const ASSESSMENTS_PAGE_SIZE = 5;

const PATH = '/v1/tenants/me/applications/{application_id}/assessments';

/** One shape for both, so the key an answered request invalidates is the key the list reads. */
function init(applicationId: string) {
  return {
    params: {
      path: { application_id: applicationId },
      query: { limit: ASSESSMENTS_PAGE_SIZE },
    },
  };
}

export function matchAssessmentsQueryKey(applicationId: string) {
  return api.queryOptions('get', PATH, init(applicationId)).queryKey;
}

export function useMatchAssessments(applicationId: string) {
  return api.useInfiniteQuery('get', PATH, init(applicationId), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => data.pages.flatMap((page) => page.items),
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}
