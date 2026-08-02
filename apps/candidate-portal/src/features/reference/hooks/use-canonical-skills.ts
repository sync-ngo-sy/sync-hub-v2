import { api } from '@/lib/api';
import { REFERENCE_CACHE } from '../reference-queries';

export function useCanonicalSkills() {
  return api.useQuery('get', '/v1/skills', undefined, REFERENCE_CACHE);
}
