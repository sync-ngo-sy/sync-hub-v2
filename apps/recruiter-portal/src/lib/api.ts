import { createApiClient } from '@sync/api-client';
import { env } from './env';

let sessionExpiredHandler: (() => void) | undefined;

/**
 * The client detects expiry (a refresh that could not be rotated) before the router exists,
 * so the router installs its handler here once it is built.
 */
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export const { client, api } = createApiClient({
  baseUrl: env.apiBaseUrl,
  onSessionExpired: () => sessionExpiredHandler?.(),
});

export const currentProfileOptions = api.queryOptions('get', '/v1/auth/me');
