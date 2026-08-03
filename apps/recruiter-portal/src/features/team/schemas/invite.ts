import { z } from 'zod';
import { RECRUITER_ROLES } from '../member';

export const inviteFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'Give the teammate’s name.')
    .max(200, 'Keep the name to 200 characters or fewer.'),
  email: z
    .string()
    .min(1, 'Enter their email address.')
    .pipe(z.email('Enter a valid email address.')),
  role: z.enum(RECRUITER_ROLES),
});

export type InviteFormValues = z.infer<typeof inviteFormSchema>;
