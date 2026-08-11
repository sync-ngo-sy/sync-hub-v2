import { readClientEnv } from '@sync/api-client';
import { z } from 'zod';

const RECRUITER_PORTAL_DEV_URL = 'http://localhost:5174';
const ADMIN_PORTAL_DEV_URL = 'http://localhost:5175';
const adminPortalUrlSchema = z
  .url({ error: 'VITE_ADMIN_PORTAL_URL must be an absolute http(s) URL' })
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    error: 'VITE_ADMIN_PORTAL_URL must be an absolute http(s) URL',
  });

export function parseAdminPortalUrl(value: string): string {
  return adminPortalUrlSchema.parse(value);
}

export const env = {
  ...readClientEnv({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  }),
  recruiterPortalUrl: z
    .url({ error: 'VITE_RECRUITER_PORTAL_URL must be an absolute http(s) URL' })
    .parse(import.meta.env.VITE_RECRUITER_PORTAL_URL ?? RECRUITER_PORTAL_DEV_URL),
  adminPortalUrl: parseAdminPortalUrl(
    import.meta.env.VITE_ADMIN_PORTAL_URL ?? ADMIN_PORTAL_DEV_URL,
  ),
};
