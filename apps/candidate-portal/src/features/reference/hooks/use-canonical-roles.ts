import { api } from '@/lib/api';
import { REFERENCE_CACHE } from '../reference-queries';

export function useCanonicalRoles() {
  return api.useQuery('get', '/v1/roles', undefined, REFERENCE_CACHE);
}
