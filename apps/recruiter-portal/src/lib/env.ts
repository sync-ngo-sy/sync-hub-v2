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
  contact: {
    whatsapp: String(import.meta.env.VITE_CONTACT_WHATSAPP ?? ''),
    email: String(import.meta.env.VITE_CONTACT_EMAIL ?? ''),
  },
};
