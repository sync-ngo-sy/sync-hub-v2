import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** The taxonomies are seeded reference data and change about never, so a session fetches each
 * once and every picker filters that one copy — which is why the cache keeps them past the last
 * page that held a picker, rather than paying for them again on the way back. */
export const REFERENCE_CACHE = { staleTime: 24 * 60 * 60 * 1000, gcTime: Number.POSITIVE_INFINITY };

export const canonicalSkillsQuery = api.queryOptions('get', '/v1/skills', undefined, {
  ...REFERENCE_CACHE,
});

export const languagesQuery = api.queryOptions('get', '/v1/languages', undefined, {
  ...REFERENCE_CACHE,
});

/** Warmed by the Job detail route, so a saved language is never read back as its raw code while
 * the list that names it is still on the wire. A taxonomy that will not load is not worth failing
 * a whole page for — the picker says so itself — so this settles either way. */
export function warmReferenceData(queryClient: QueryClient): Promise<unknown> {
  const settled = (loading: Promise<unknown>) => loading.catch(() => undefined);
  return Promise.all([
    settled(queryClient.ensureQueryData(canonicalSkillsQuery)),
    settled(queryClient.ensureQueryData(languagesQuery)),
  ]);
}
