import { z } from 'zod';
import { email } from '@/features/auth/schemas/fields';

export const accessRequestSchema = z.object({
  company: z
    .string()
    .trim()
    .min(1, 'Enter your company name.')
    .max(200, 'Use 200 characters or fewer.'),
  full_name: z.string().trim().min(1, 'Enter your name.').max(200, 'Use 200 characters or fewer.'),
  email,
});

export type AccessRequestValues = z.infer<typeof accessRequestSchema>;
