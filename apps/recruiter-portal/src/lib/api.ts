import { createApiClient } from '@sync/api-client';
import { env } from './env';

let sessionExpiredHandler: (() => void) | undefined;

/** One slot, installed by the router once it exists: the newest router wins. */
export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export const { client, api } = createApiClient({
  baseUrl: env.apiBaseUrl,
  onSessionExpired: () => sessionExpiredHandler?.(),
});

export const currentProfileOptions = api.queryOptions('get', '/v1/auth/me');
