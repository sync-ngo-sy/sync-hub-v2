import { z } from 'zod';

export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 63;

const slug = z
  .string()
  .trim()
  .min(1, 'Enter the tenant address.')
  .min(SLUG_MIN_LENGTH, `Use at least ${SLUG_MIN_LENGTH} characters.`)
  .max(SLUG_MAX_LENGTH, `Use ${SLUG_MAX_LENGTH} characters or fewer.`)
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
