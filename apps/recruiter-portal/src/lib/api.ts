import { createApiClient } from '@sync/api-client';
import { env } from './env';

let handleSessionExpired: (() => void) | undefined;

/** One slot, claimed by the router once it exists — the newest router wins. */
export function onSessionExpired(handler: () => void): void {
  handleSessionExpired = handler;
}

export const { client, api } = createApiClient({
  baseUrl: env.apiBaseUrl,
  onSessionExpired: () => handleSessionExpired?.(),
});
