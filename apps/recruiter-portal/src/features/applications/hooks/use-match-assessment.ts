import { api } from '@/lib/api';
import { ASSESSMENT_PATH, onApplication } from '../reread';

export function useMatchAssessment(applicationId: string) {
  return api.useQuery('get', ASSESSMENT_PATH, onApplication(applicationId), {
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}
