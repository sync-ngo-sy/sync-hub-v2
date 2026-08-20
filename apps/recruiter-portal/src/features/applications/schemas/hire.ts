import { z } from 'zod';

export const hireSchema = z.object({
  startDate: z
    .string()
    .min(1, 'Name the day the work starts.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'That is not a day.'),
});

export type HireValues = z.infer<typeof hireSchema>;
