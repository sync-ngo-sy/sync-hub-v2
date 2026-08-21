import { useQuery } from '@tanstack/react-query';
import { matchAssessment } from '../reread';

export function useMatchAssessment(applicationId: string) {
  return useQuery({
    ...matchAssessment(applicationId),
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}
