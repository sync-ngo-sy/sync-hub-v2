import { api } from '../../../lib/api-client';

/** How often the bell re-checks the unread count in the background. */
export const UNREAD_COUNT_POLL_MS = 60_000;

/** The number on the bell, refreshed on an interval and whenever the window regains focus. */
export function useUnreadCount() {
  return api.useQuery('get', '/v1/notifications/unread-count', undefined, {
    refetchInterval: UNREAD_COUNT_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
    throwOnError: false,
  });
}
