import { z } from 'zod';

export const trackedLinkSearchParams = z.object({
  q: z.string().optional().catch(undefined),
  state: z.enum(['all', 'live', 'expired', 'off']).optional().catch(undefined),
});

export type TrackedLinkSearchParams = z.infer<typeof trackedLinkSearchParams>;
