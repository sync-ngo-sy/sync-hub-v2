import { z } from 'zod';

export const profileSearchSchema = z.object({
  fill: z.uuid().optional().catch(undefined),
});

export type ProfileSearch = z.infer<typeof profileSearchSchema>;
