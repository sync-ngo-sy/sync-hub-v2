import { z } from 'zod';
import {
  applicationSort,
  pipelineStatuses,
  receivedWithinWindow,
  screeningVerdicts,
} from '@/features/applications/schemas/filters';

export const applicationsSearchParams = z.object({
  pipeline: pipelineStatuses.optional().catch(undefined),
  screening: screeningVerdicts.optional().catch(undefined),
  received: receivedWithinWindow.optional().catch(undefined),
  sort: applicationSort.optional().catch(undefined),
});
