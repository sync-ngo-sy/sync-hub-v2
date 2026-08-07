import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { type Cv, isParsing } from '../cv';

export const myCvsQuery = api.queryOptions('get', '/v1/candidates/me/cvs');

const PARSE_POLL_MS = 2_000;

export function useMyCvs() {
  const cvs = api.useQuery('get', '/v1/candidates/me/cvs', undefined, {
    refetchInterval: ({ state }) =>
      (state.data as Cv[] | undefined)?.some(isParsing) ? PARSE_POLL_MS : false,
  });

  const { error } = cvs;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'CVs' });
  }, [error]);

  return cvs;
}
