import { api } from '@/lib/api';
import { type Cv, isParsing } from '../cv';

export const myCvsQuery = api.queryOptions('get', '/v1/candidates/me/cvs');

const PARSE_POLL_MS = 2_000;

/** `parsing_status` is only ever settled by the API, so a CV mid-parse is polled until it
 * leaves `processing` — and the polling stops the moment none is left. */
export function useMyCvs() {
  return api.useQuery('get', '/v1/candidates/me/cvs', undefined, {
    refetchInterval: ({ state }) =>
      (state.data as Cv[] | undefined)?.some(isParsing) ? PARSE_POLL_MS : false,
  });
}
