import { useMutation } from '@tanstack/react-query';
import { useRereadTenantStats } from '@/features/dashboard/reread';
import { useRereadHireClaims } from '@/features/placements/reread';
import { api, client } from '@/lib/api';
import type { PipelineStatus } from '../application';
import { aFewAtATime, type Moved, movedTogether } from '../ending';
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

export interface TickedMove {
  ids: string[];
  to: PipelineStatus;
}

/**
 * The rows a Recruiter ticked, moved one at a time — which is what the Tenant-wide list offers
 * instead of a sweep, both for ending them and for taking a sweep back.
 *
 * A few requests at once rather than all of them: a reader who ticked a whole loaded page would
 * otherwise open a hundred. A row the pipeline refuses is a row that moved between the tick and
 * the click, and that is an answer rather than a failure — it comes back as one fewer move. A move
 * that failed for any other reason is raised, and the lists are read again either way, because
 * some of them did move and a screen still showing them where they were is worse than the failure.
 */
export function useMoveTickedApplications() {
  const reread = useRereadEndedApplications();
  const rereadStats = useRereadTenantStats();

  return useMutation({
    mutationFn: async ({ ids, to }: TickedMove): Promise<Moved> => {
      const outcomes = await aFewAtATime(ids, (id) => moveOne(id, to));
      const refused = outcomes.find((one) => one.status === 'rejected');
      if (refused) throw refused.reason;
      return movedTogether(outcomes.map((one) => (one.status === 'fulfilled' ? one.value : null)));
    },
    onSettled: () => Promise.all([reread(), rereadStats()]),
  });
}

async function moveOne(applicationId: string, to: PipelineStatus) {
  const { data, error, response } = await client.PATCH(APPLICATION_PATH, {
    params: { path: { application_id: applicationId } },
    body: { status: to, start_date: null },
  });
  if (data) return data;
  if (response.status === 409) return null;
  throw error;
}

export function useAssessMatch(applicationId: string) {
  const reread = useRereadMatchAssessment(applicationId);

  return api.useMutation('post', ASSESSMENT_PATH, { onSuccess: reread });
}

export function useMessageApplicant() {
  return api.useMutation('post', MESSAGES_PATH);
}
