import { z } from 'zod';

export const profileSearchSchema = z.object({
  update: z.uuid().optional().catch(undefined),
});

export type ProfileSearch = z.infer<typeof profileSearchSchema>;
