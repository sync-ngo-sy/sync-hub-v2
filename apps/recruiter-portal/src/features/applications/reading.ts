import { z } from 'zod';
import {
  EVERY_TIME,
  holdsOneStatus,
  pipelineInAddress,
  pipelineTab,
  receivedSelection,
  SCREENING_VERDICTS,
  screeningSelection,
  sortInAddress,
} from './application';
import {
  applicationSort,
  pipelineTabSelection,
  receivedWithinWindow,
  screeningVerdicts,
} from './schemas/filters';

export const applicationsReading = z.object({
  pipeline: pipelineTabSelection.optional().catch(undefined),
  screening: screeningVerdicts.optional().catch(undefined),
  received: receivedWithinWindow.optional().catch(undefined),
  sort: applicationSort.optional().catch(undefined),
});

export const jobApplicationsReading = applicationsReading.pick({
  pipeline: true,
  screening: true,
  sort: true,
});

export type TenantApplicationFilters = z.infer<typeof applicationsReading>;
export type ApplicationFilters = z.infer<typeof jobApplicationsReading>;

export function narrowedBy(filters: TenantApplicationFilters): number {
  return [
    holdsOneStatus(pipelineTab(filters.pipeline)),
    screeningSelection(filters.screening).length < SCREENING_VERDICTS.length,
    receivedSelection(filters.received) !== EVERY_TIME,
  ].filter(Boolean).length;
}

const NO_APPLICATIONS_YET =
  'No Applications yet — publish a Job and share its tracked links to bring candidates in.';

const NOBODY_HAS_APPLIED =
  'No one has applied yet — a tracked link is the quickest way to bring candidates to this Job.';

const EVERYTHING_HAS_ENDED =
  'Nothing is waiting on a decision — every Application this Tenant received has ended.';

const EVERYTHING_ON_THIS_JOB_HAS_ENDED =
  'Nothing on this Job is waiting on a decision — every Application it received has ended.';

export function noApplicationsMessage(filters: TenantApplicationFilters, ended: boolean): string {
  const narrowing = narrowedBy(filters);
  if (narrowing === 0) return ended ? EVERYTHING_HAS_ENDED : NO_APPLICATIONS_YET;
  return narrowing === 1
    ? 'No Application matches that filter.'
    : 'No Application matches these filters.';
}

export function noJobApplicationsMessage(filters: ApplicationFilters, ended: boolean): string {
  const narrowing = narrowedBy(filters);
  if (narrowing === 0) return ended ? EVERYTHING_ON_THIS_JOB_HAS_ENDED : NOBODY_HAS_APPLIED;
  return narrowing === 1
    ? 'No Application on this Job matches that filter.'
    : 'No Application on this Job matches both filters.';
}

export function clearFiltersLabel(filters: TenantApplicationFilters): string {
  return narrowedBy(filters) === 1 ? 'Clear filter' : 'Clear filters';
}

type Address<TFilters> = { [K in keyof Required<TFilters>]: TFilters[K] };

export function applicationsAddress(
  filters: TenantApplicationFilters,
): Address<TenantApplicationFilters> {
  return {
    pipeline: pipelineInAddress(filters.pipeline),
    screening: filters.screening,
    received: filters.received,
    sort: sortInAddress(filters.sort),
  };
}

export function jobApplicationsAddress(filters: ApplicationFilters): Address<ApplicationFilters> {
  return {
    pipeline: pipelineInAddress(filters.pipeline),
    screening: filters.screening,
    sort: sortInAddress(filters.sort),
  };
}
