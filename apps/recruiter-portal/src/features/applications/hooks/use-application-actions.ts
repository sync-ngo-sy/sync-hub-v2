import { useRereadTenantStats } from '@/features/dashboard/reread';
import { api } from '@/lib/api';
import {
  APPLICATION_PATH,
  ASSESSMENT_PATH,
  MESSAGES_PATH,
  useRereadMatchAssessment,
  useRereadMovedApplication,
} from '../reread';

export function useMoveApplication(applicationId: string) {
  const rereadApplications = useRereadMovedApplication(applicationId);
  const rereadStats = useRereadTenantStats();

  return api.useMutation('patch', APPLICATION_PATH, {
    onSuccess: () => Promise.all([rereadApplications(), rereadStats()]),
  });
}

export function useAssessMatch(applicationId: string) {
  const reread = useRereadMatchAssessment(applicationId);

  return api.useMutation('post', ASSESSMENT_PATH, { onSuccess: reread });
}

export function useMessageApplicant() {
  return api.useMutation('post', MESSAGES_PATH);
}
