import { z } from 'zod';
import {
  applicationSort,
  pipelineTabSelection,
  receivedWithinWindow,
  screeningVerdicts,
} from '@/features/applications/schemas/filters';

export const applicationsSearchParams = z.object({
  pipeline: pipelineTabSelection.optional().catch(undefined),
  screening: screeningVerdicts.optional().catch(undefined),
  received: receivedWithinWindow.optional().catch(undefined),
  sort: applicationSort.optional().catch(undefined),
});
