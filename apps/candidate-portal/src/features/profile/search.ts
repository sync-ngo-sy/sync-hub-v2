import { z } from 'zod';

export const profileSearchSchema = z.object({
  fill: z.uuid().optional().catch(undefined),
  // PROTOTYPE for #369 — throwaway, with `features/profile/prototype/`. Read in DEV only.
  variant: z.enum(['A', 'B', 'C']).optional().catch(undefined),
});

export type ProfileSearch = z.infer<typeof profileSearchSchema>;
