import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** The taxonomies are seeded reference data and change about never, so a session fetches each
 * once and every picker filters that one copy. */
const REFERENCE_STALE_TIME = 24 * 60 * 60 * 1000;

export const canonicalSkillsQuery = api.queryOptions('get', '/v1/skills', undefined, {
  staleTime: REFERENCE_STALE_TIME,
});

export const languagesQuery = api.queryOptions('get', '/v1/languages', undefined, {
  staleTime: REFERENCE_STALE_TIME,
});

/** Warmed by the routes that hold pickers, so a saved value is never read back as its raw code
 * while the list it names is still on the wire. A taxonomy that will not load is not worth
 * failing a whole page for — the picker says so itself — so this settles either way. */
export function warmReferenceData(queryClient: QueryClient): Promise<unknown> {
  const settled = <Data>(loading: Promise<Data>) => loading.catch(() => undefined);
  return Promise.all([
    settled(queryClient.ensureQueryData(canonicalSkillsQuery)),
    settled(queryClient.ensureQueryData(languagesQuery)),
  ]);
}
