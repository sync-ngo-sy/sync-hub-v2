import { api } from '@/lib/api';
import { claimCountsFrom, type HireConfirmation } from '../placement';
import { HIRE_CLAIMS_PATH, hireClaimsPage } from '../reread';

export function useHireClaims(tab: HireConfirmation, job: string | undefined) {
  return api.useInfiniteQuery('get', HIRE_CLAIMS_PATH, hireClaimsPage(tab, job), {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items),
      counts: claimCountsFrom(data.pages[0]?.counts),
      jobs: data.pages[0]?.jobs ?? [],
    }),
  });
}
