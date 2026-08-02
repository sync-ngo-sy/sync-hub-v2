import { api } from '@/lib/api';
import { REFERENCE_CACHE } from '../reference-queries';

export function useLanguages() {
  return api.useQuery('get', '/v1/languages', undefined, REFERENCE_CACHE);
}
