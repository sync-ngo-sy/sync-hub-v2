import { api } from '@/lib/api';
import { claimCountsFrom, type HireConfirmation } from '../placement';
import { HIRE_CLAIMS_PATH, hireClaimsPage } from '../reread';

export function useHireClaims(tab: HireConfirmation) {
  return api.useInfiniteQuery('get', HIRE_CLAIMS_PATH, hireClaimsPage(tab), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items),
      counts: claimCountsFrom(data.pages[0]?.counts),
    }),
  });
}
