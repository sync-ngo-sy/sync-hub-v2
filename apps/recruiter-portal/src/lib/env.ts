import { readClientEnv } from '@sync/api-client';

/**
 * Same-origin is the production topology (the portal is served same-site with the API) and
 * the dev topology (the Vite proxy forwards `/v1`), so an unset base URL is the default
 * rather than an error. A malformed one still fails loudly at startup.
 */
export const env = readClientEnv({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
});
