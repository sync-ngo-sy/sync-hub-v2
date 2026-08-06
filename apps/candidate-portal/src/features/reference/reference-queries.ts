import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const REFERENCE_CACHE = { staleTime: 24 * 60 * 60 * 1000, gcTime: Number.POSITIVE_INFINITY };

export const canonicalSkillsQuery = api.queryOptions('get', '/v1/skills', undefined, {
  ...REFERENCE_CACHE,
});

export const languagesQuery = api.queryOptions('get', '/v1/languages', undefined, {
  ...REFERENCE_CACHE,
});

export const locationsQuery = api.queryOptions('get', '/v1/locations', undefined, {
  ...REFERENCE_CACHE,
});

export const canonicalRolesQuery = api.queryOptions('get', '/v1/roles', undefined, {
  ...REFERENCE_CACHE,
});

export function warmReferenceData(queryClient: QueryClient): Promise<unknown> {
  const settled = (loading: Promise<unknown>) => loading.catch(() => undefined);
  return Promise.all([
    settled(queryClient.ensureQueryData(canonicalSkillsQuery)),
    settled(queryClient.ensureQueryData(languagesQuery)),
    settled(queryClient.ensureQueryData(locationsQuery)),
    settled(queryClient.ensureQueryData(canonicalRolesQuery)),
  ]);
}
