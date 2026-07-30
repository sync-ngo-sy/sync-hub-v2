import { api } from '../../../lib/api-client';

const PAGE_SIZE = 20;

export function useBrowseJobs() {
  return api.useInfiniteQuery(
    'get',
    '/v1/jobs',
    { params: { query: { limit: PAGE_SIZE } } },
    {
      // `null` is dropped by the query serializer, so the first page asks for no cursor — the
      // newest page. Each following page carries the previous response's `next_cursor`.
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? null,
      pageParamName: 'cursor',
      // Only surface a first-page failure to the boundary; a Load-more failure keeps the list.
      throwOnError: (_error, query) => query.state.data === undefined,
    },
  );
}
