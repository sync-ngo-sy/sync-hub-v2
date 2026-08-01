import { z } from 'zod';

/** What the profile column actually holds — `sync_core.profile.MAX_YEARS_EXPERIENCE`. */
const MAX_YEARS = 999.9;

/** Indexed rather than keyed by skill name: "Node.js" would read as a path to React Hook Form. */
export const reviewSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string(),
      years: z
        .string()
        .trim()
        .min(1, 'Enter the years.')
        // One decimal place, because that is what the profile stores.
        .regex(/^\d+(\.\d)?$/, 'Use a number of years, like 3 or 4.5.')
        .refine((years) => Number(years) <= MAX_YEARS, {
          message: 'That is more years than the platform records.',
        }),
    }),
  ),
});

export type ReviewValues = z.infer<typeof reviewSchema>;
