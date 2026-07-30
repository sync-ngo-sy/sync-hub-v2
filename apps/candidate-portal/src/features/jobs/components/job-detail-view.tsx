import type { components } from '@sync/api-client/schema';
import { JobDetail } from './job-detail';
import { JobNotFound } from './job-not-found';
import { JobDetailSkeleton } from './job-skeletons';

type PublicJob = components['schemas']['PublicJob'];

interface JobDetailViewProps {
  job: PublicJob | undefined;
  isPending: boolean;
  /** True when the Job is unknown or its link is dead — a 404 the hooks keep out of the boundary. */
  notFound: boolean;
  /** Where a signed-out visitor returns after auth — the Job's own path or its Tracked link. */
  returnTo: string;
}

// Shared by the Job detail and Tracked-link routes. Other load failures never reach here — the
// query throws them into the surrounding boundary — so this only resolves pending, not-found, and
// the Job itself.
export function JobDetailView({ job, isPending, notFound, returnTo }: JobDetailViewProps) {
  if (isPending) return <JobDetailSkeleton />;
  if (notFound || !job) return <JobNotFound />;
  return <JobDetail job={job} returnTo={returnTo} />;
}
