import { z } from 'zod';

const slug = z
  .string()
  .trim()
  .min(1, 'Enter the tenant address.')
  .min(2, 'Use at least 2 characters.')
  .max(63, 'Use 63 characters or fewer.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only.');

export const tenantSlugSchema = z.object({ slug });

export type TenantSlugFormValues = z.infer<typeof tenantSlugSchema>;

export const createTenantSchema = z.object({
  name: z.string().trim().min(1, 'Enter the tenant name.').max(200, 'Use 200 characters or fewer.'),
  slug,
  full_name: z
    .string()
    .trim()
    .min(1, "Enter the founding admin's name.")
    .max(200, 'Use 200 characters or fewer.'),
  email: z.string().trim().pipe(z.email('Enter a valid email address.')),
});

export type CreateTenantFormValues = z.infer<typeof createTenantSchema>;
