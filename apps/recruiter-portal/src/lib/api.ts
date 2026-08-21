import { createApiClient } from '@sync/api-client';
import { accessRefusal } from '@/features/tenant/refusal';
import { env } from './env';

let handleSessionExpired: (() => void) | undefined;
let handleAccessRefused: (() => void) | undefined;

export function onSessionExpired(handler: () => void): void {
  handleSessionExpired = handler;
}

export function onAccessRefused(handler: () => void): void {
  handleAccessRefused = handler;
}

export const { client, api } = createApiClient({
  baseUrl: env.apiBaseUrl,
  onSessionExpired: () => handleSessionExpired?.(),
});

client.use({
  async onResponse({ response }) {
    if (response.status !== 403) return;
    const problem: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (accessRefusal(problem)) handleAccessRefused?.();
  },
});
