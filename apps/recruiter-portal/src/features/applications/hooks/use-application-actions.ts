import { useRereadTenantStats } from '@/features/dashboard/reread';
import { useRereadHireClaims } from '@/features/placements/reread';
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
  const rereadHireClaims = useRereadHireClaims();

  return api.useMutation('patch', APPLICATION_PATH, {
    onSuccess: () => Promise.all([rereadApplications(), rereadStats(), rereadHireClaims()]),
  });
}

export function useAssessMatch(applicationId: string) {
  const reread = useRereadMatchAssessment(applicationId);

  return api.useMutation('post', ASSESSMENT_PATH, { onSuccess: reread });
}

export function useMessageApplicant() {
  return api.useMutation('post', MESSAGES_PATH);
}
