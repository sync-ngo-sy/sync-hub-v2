import { useMutation } from '@tanstack/react-query';
import { useRereadTenantStats } from '@/features/dashboard/reread';
import { useRereadHireClaims } from '@/features/placements/reread';
import { api, client } from '@/lib/api';
import { type SweptApplications, sweptTogether } from '../ending';
import {
  APPLICATION_PATH,
  ASSESSMENT_PATH,
  MESSAGES_PATH,
  SWEEP_PATH,
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

/** One sweep of a Job's Applications: the Reading goes over, and no ids at all. */
export function useSweepJobApplications() {
  const reread = useRereadEndedApplications();
  const rereadStats = useRereadTenantStats();

  return api.useMutation('post', SWEEP_PATH, {
    onSuccess: () => Promise.all([reread(), rereadStats()]),
  });
}

/**
 * The rows a Recruiter ticked, ended one move at a time — which is what the Tenant-wide list
 * offers instead of a sweep.
 *
 * A row that moved between the tick and the click is a row the pipeline refuses, and that is an
 * answer rather than a failure: it comes back as one fewer ending. A move that failed for any
 * other reason is raised, and the lists are read again either way — some of them did end, and a
 * screen still showing them as open would be the one thing worse than the failure.
 */
export function useEndApplications() {
  const reread = useRereadEndedApplications();
  const rereadStats = useRereadTenantStats();

  return useMutation({
    mutationFn: async (ids: string[]): Promise<SweptApplications> => {
      const moves = await Promise.allSettled(ids.map(endOne));
      const failed = moves.find((move) => move.status === 'rejected');
      if (failed) throw failed.reason;
      return sweptTogether(moves.map((move) => (move.status === 'fulfilled' ? move.value : null)));
    },
    onSettled: () => Promise.all([reread(), rereadStats()]),
  });
}

async function endOne(applicationId: string) {
  const { data, error, response } = await client.PATCH(APPLICATION_PATH, {
    params: { path: { application_id: applicationId } },
    body: { status: 'rejected', start_date: null },
  });
  if (data) return data;
  // The pipeline refusing the move, or the row having gone: it is no longer a row to end, which
  // is what the answer says rather than what it fails over.
  if (response.status === 409 || response.status === 404) return null;
  throw error;
}

export function useAssessMatch(applicationId: string) {
  const reread = useRereadMatchAssessment(applicationId);

  return api.useMutation('post', ASSESSMENT_PATH, { onSuccess: reread });
}

export function useMessageApplicant() {
  return api.useMutation('post', MESSAGES_PATH);
}
