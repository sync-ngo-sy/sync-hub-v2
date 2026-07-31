import { readClientEnv } from '@sync/api-client';

/**
 * An unset base URL means same-origin, which is the topology in dev (behind the Vite
 * proxy) and in production (portals served same-site with the API).
 */
export const env = readClientEnv({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
});
