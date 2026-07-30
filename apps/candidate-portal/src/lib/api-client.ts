import { createApiClient } from '@sync/api-client';
import { clientEnv } from './env';
import { notifySessionExpired } from './session';

export const { client, api } = createApiClient({
  baseUrl: clientEnv.apiBaseUrl,
  onSessionExpired: notifySessionExpired,
});

export const profileQueryOptions = api.queryOptions('get', '/v1/auth/me');
