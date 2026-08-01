import { readClientEnv } from '@sync/api-client';

/**
 * An unset base URL means same-origin, which is the topology in dev (behind the Vite
 * proxy) and in production (portals served same-site with the API).
 */
export const env = {
  ...readClientEnv({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  }),
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
