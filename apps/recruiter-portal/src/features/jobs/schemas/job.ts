import { z } from 'zod';

const optionalLine = z.string().trim().max(200, 'Keep this to 200 characters or fewer.');

export const jobFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Enter a job title.')
    .max(200, 'Keep the title to 200 characters or fewer.'),
  description: z
    .string()
    .trim()
    .min(1, 'Enter a job description.')
    .max(5_000, 'Keep the description to 5,000 characters or fewer.'),
  location: optionalLine,
  employmentType: optionalLine,
  expiresAt: z
    .string()
    .refine((value) => value === '' || !Number.isNaN(new Date(value).getTime()), {
      message: 'Enter a valid date and time.',
    }),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;
