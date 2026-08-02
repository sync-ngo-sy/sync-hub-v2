import { createApiClient } from '@sync/api-client';
import { env } from './env';

let onSessionExpired: (() => void) | undefined;

export function registerSessionExpiry(handler: () => void): void {
  onSessionExpired = handler;
}

export const { api } = createApiClient({
  baseUrl: env.apiBaseUrl,
  onSessionExpired: () => onSessionExpired?.(),
});
