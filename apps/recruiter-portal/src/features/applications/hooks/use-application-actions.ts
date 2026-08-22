import { useRereadTenantStats } from '@/features/dashboard/reread';
import { useRereadHireClaims } from '@/features/placements/reread';
import { api } from '@/lib/api';
import {
  APPLICATION_PATH,
  ASSESSMENT_PATH,
  MESSAGES_PATH,
  SWEEP_PATH,
  TENANT_SWEEP_PATH,
  TICKED_PATH,
  useRereadEndedApplications,
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

export function useSweepJobApplications() {
  const reread = useRereadEndedApplications();
  const rereadStats = useRereadTenantStats();

  return api.useMutation('post', SWEEP_PATH, {
    onSuccess: () => Promise.all([reread(), rereadStats()]),
  });
}

export function useSweepTenantApplications() {
  const reread = useRereadEndedApplications();
  const rereadStats = useRereadTenantStats();

  return api.useMutation('post', TENANT_SWEEP_PATH, {
    onSuccess: () => Promise.all([reread(), rereadStats()]),
  });
}

export function useMoveTickedApplications() {
  const reread = useRereadEndedApplications();
  const rereadStats = useRereadTenantStats();

  return api.useMutation('post', TICKED_PATH, {
    onSettled: () => Promise.all([reread(), rereadStats()]),
  });
}

export function useAssessMatch(applicationId: string) {
  const reread = useRereadMatchAssessment(applicationId);

  return api.useMutation('post', ASSESSMENT_PATH, { onSuccess: reread });
}

export function useMessageApplicant() {
  return api.useMutation('post', MESSAGES_PATH);
}
