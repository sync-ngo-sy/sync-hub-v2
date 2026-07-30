import createFetchClient, { type Client } from 'openapi-fetch';
import type { OpenapiQueryClient } from 'openapi-react-query';
import createQueryClient from 'openapi-react-query';
import { createAuthFetch, csrfMiddleware } from './middleware';
import type { paths } from './schema.gen';

export type ApiFetchClient = Client<paths>;
export type Api = OpenapiQueryClient<paths>;

export interface CreateApiClientOptions {
  /** Origin the `/v1/...` paths resolve against; empty string means same-origin. */
  baseUrl: string;
  /** Invoked when the session is unrecoverable — a failed refresh or a second 401. */
  onSessionExpired?: () => void;
}

export interface SyncApiClient {
  /** Low-level typed fetch client (openapi-fetch), for the rare non-hook call. */
  client: ApiFetchClient;
  /** Typed TanStack Query hooks (openapi-react-query) both portals consume. */
  api: Api;
}

/**
 * Assemble the shared API client: cookie credentials on every request, the CSRF header on
 * mutations, and one-shot session refresh on 401 — all invisible to callers, who only ever
 * touch the returned typed hooks.
 */
export function createApiClient({
  baseUrl,
  onSessionExpired,
}: CreateApiClientOptions): SyncApiClient {
  const client = createFetchClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: createAuthFetch({ baseUrl, onSessionExpired }),
  });
  client.use(csrfMiddleware);
  const api = createQueryClient(client);
  return { client, api };
}
