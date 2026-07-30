import { api } from '../../../lib/api-client';
import { errorStatus } from '../../../lib/errors';

export function useJobByLink(token: string) {
  return api.useQuery(
    'get',
    '/v1/jobs/by-link/{token}',
    { params: { path: { token } } },
    // A dead link 404s; that renders inline as a not-found, while other failures go to the boundary.
    { throwOnError: (error) => errorStatus(error) !== 404 },
  );
}
