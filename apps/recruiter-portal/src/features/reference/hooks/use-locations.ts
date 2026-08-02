import { api } from '@/lib/api';
import { REFERENCE_CACHE } from '../reference-queries';

export function useLocations() {
  return api.useQuery('get', '/v1/locations', undefined, REFERENCE_CACHE);
}
