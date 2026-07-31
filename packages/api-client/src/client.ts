import createFetchClient, { type Client } from 'openapi-fetch';
import createQueryClient, { type OpenapiQueryClient } from 'openapi-react-query';
import { assertApiBase } from './env';
import { createAuthFetch, csrfMiddleware } from './middleware';
import type { paths } from './schema.gen';

export type ApiFetchClient = Client<paths>;

export type Api = OpenapiQueryClient<paths>;

export interface CreateApiClientOptions {
  baseUrl: string;
  onSessionExpired?: () => void;
}

export interface SyncApiClient {
  client: ApiFetchClient;
  api: Api;
}

export function createApiClient(options: CreateApiClientOptions): SyncApiClient {
  const baseUrl = assertApiBase(options.baseUrl);
  const { onSessionExpired } = options;
  const client = createFetchClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: createAuthFetch({ baseUrl, onSessionExpired }),
  });
  client.use(csrfMiddleware);
  return { client, api: createQueryClient(client) };
}
