import { z } from 'zod';
import { pipelineStatuses, receivedWithinWindow } from '@/features/applications/schemas/filters';

export const applicationsSearchParams = z.object({
  pipeline: pipelineStatuses.optional().catch(undefined),
  received: receivedWithinWindow.optional().catch(undefined),
});
