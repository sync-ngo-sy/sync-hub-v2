import { z } from 'zod';
import { email, newPassword } from './fields';

export const tenantSignUpSchema = z.object({
  tenant_name: z
    .string()
    .trim()
    .min(1, 'Enter your workspace name.')
    .max(200, 'Use 200 characters or fewer.'),
  slug: z
    .string()
    .trim()
    .min(1, 'Enter a workspace address.')
    .min(2, 'Use at least 2 characters.')
    .max(63, 'Use 63 characters or fewer.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only.'),
  full_name: z.string().trim().min(1, 'Enter your name.').max(200, 'Use 200 characters or fewer.'),
  email,
  password: newPassword,
});

export type TenantSignUpValues = z.infer<typeof tenantSignUpSchema>;
