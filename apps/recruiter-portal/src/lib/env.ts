import { readClientEnv } from '@sync/api-client';
import { z } from 'zod';

const CANDIDATE_PORTAL_DEV_URL = 'http://localhost:5173';
const ADMIN_PORTAL_DEV_URL = 'http://localhost:5175';

function portalUrlSchema(variable: string) {
  const error = `${variable} must be an absolute http(s) URL`;
  return z
    .url({ error })
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), { error });
}

export function parseAdminPortalUrl(value: string): string {
  return portalUrlSchema('VITE_ADMIN_PORTAL_URL').parse(value);
}

export function parseCandidatePortalUrl(value: string): string {
  return portalUrlSchema('VITE_CANDIDATE_PORTAL_URL').parse(value);
}

/**
 * An unset base URL means same-origin, which is the topology in dev (behind the Vite
 * proxy) and in production (portals served same-site with the API).
 */
export const env = {
  ...readClientEnv({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  }),
  adminPortalUrl: parseAdminPortalUrl(
    import.meta.env.VITE_ADMIN_PORTAL_URL ?? ADMIN_PORTAL_DEV_URL,
  ),
  candidatePortalUrl: parseCandidatePortalUrl(
    import.meta.env.VITE_CANDIDATE_PORTAL_URL ?? CANDIDATE_PORTAL_DEV_URL,
  ),
  /**
   * The Sync team's one global contact, offered on the landing page — never a Tenant's own.
   * Read raw and judged by the landing: this module is on the import path of every route
   * through `lib/api`, so a marketing detail must never be able to keep the portal from
   * starting.
   */
  contact: {
    whatsapp: String(import.meta.env.VITE_CONTACT_WHATSAPP ?? ''),
    email: String(import.meta.env.VITE_CONTACT_EMAIL ?? ''),
  },
};
