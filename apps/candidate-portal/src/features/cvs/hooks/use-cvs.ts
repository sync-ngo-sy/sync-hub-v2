import { api } from '../../../lib/api-client';
import { type Cv, isParsing } from '../status';

export const cvsQueryOptions = api.queryOptions('get', '/v1/candidates/me/cvs');

const POLL_INTERVAL_MS = 2000;

export function useCvs() {
  return api.useQuery('get', '/v1/candidates/me/cvs', undefined, {
    refetchInterval: (query) => {
      const cvs = query.state.data as Cv[] | undefined;
      return cvs?.some(isParsing) ? POLL_INTERVAL_MS : false;
    },
  });
}
