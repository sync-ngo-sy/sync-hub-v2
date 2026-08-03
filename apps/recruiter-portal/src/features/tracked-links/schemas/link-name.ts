import { z } from 'zod';

export const linkNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the channel this link is for.')
    .max(200, 'Keep the name to 200 characters or fewer.'),
});

export type LinkNameValues = z.infer<typeof linkNameSchema>;
