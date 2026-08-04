import { api } from '@/lib/api';
import { activeFor, type LinkFilter } from '../tracked-link';

export const TENANT_LINKS_PAGE_SIZE = 20;

function linkParams(q: string, filter: LinkFilter) {
  return {
    params: {
      query: {
        limit: TENANT_LINKS_PAGE_SIZE,
        q: q === '' ? undefined : q,
        is_active: activeFor(filter),
      },
    },
  };
}

export function useTenantTrackedLinks(q: string, filter: LinkFilter) {
  return api.useInfiniteQuery('get', '/v1/tenants/me/tracked-links', linkParams(q, filter), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => data.pages.flatMap((page) => page.items),
  });
}
