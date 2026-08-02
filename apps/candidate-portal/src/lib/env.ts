import { readClientEnv } from '@sync/api-client';
import { z } from 'zod';

/** Each portal runs on its own dev server, and on its own hostname in production. */
const RECRUITER_PORTAL_DEV_URL = 'http://localhost:5174';
const ADMIN_PORTAL_DEV_URL = 'http://localhost:5175';

/**
 * An unset base URL means same-origin, which is the topology in dev (behind the Vite
 * proxy) and in production (portals served same-site with the API).
 */
export const env = {
  ...readClientEnv({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  }),
  /** Where the landing's employer CTAs lead: the Recruiter Portal explains Sync to companies. */
  recruiterPortalUrl: z
    .url({ error: 'VITE_RECRUITER_PORTAL_URL must be an absolute http(s) URL' })
    .parse(import.meta.env.VITE_RECRUITER_PORTAL_URL ?? RECRUITER_PORTAL_DEV_URL),
  adminPortalUrl: z
    .url({ error: 'VITE_ADMIN_PORTAL_URL must be an absolute http(s) URL' })
    .parse(import.meta.env.VITE_ADMIN_PORTAL_URL ?? ADMIN_PORTAL_DEV_URL),
};
