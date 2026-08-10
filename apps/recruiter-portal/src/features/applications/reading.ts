import { z } from 'zod';
import { sortInAddress } from './application';
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
});

export type TenantApplicationFilters = z.infer<typeof applicationsReading>;
export type ApplicationFilters = z.infer<typeof jobApplicationsReading>;

type Address<TFilters> = { [K in keyof Required<TFilters>]: TFilters[K] };

export function applicationsAddress(
  filters: TenantApplicationFilters,
): Address<TenantApplicationFilters> {
  return {
    pipeline: filters.pipeline,
    screening: filters.screening,
    received: filters.received,
    sort: sortInAddress(filters.sort),
  };
}

export function jobApplicationsAddress(filters: ApplicationFilters): Address<ApplicationFilters> {
  return {
    pipeline: filters.pipeline,
    screening: filters.screening,
  };
}
