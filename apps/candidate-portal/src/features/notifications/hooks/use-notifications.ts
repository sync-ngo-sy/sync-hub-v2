import { useInfiniteQuery } from '@tanstack/react-query';
import { client } from '../../../lib/api-client';

const PAGE_SIZE = 20;

/**
 * Query key for the notification list. Shared with `useMarkNotificationRead` so marking one
 * read refreshes the same cache the bell dropdown and the view-all page read from.
 */
export const NOTIFICATIONS_QUERY_KEY = ['notifications', 'list'] as const;

/**
 * The caller's notifications, cursor-paged newest-first. Owns its own key and queryFn rather
 * than `api.useInfiniteQuery`, whose page param defaults to `0` and would send an invalid
 * `cursor=0` on the first page instead of omitting it.
 */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await client.GET('/v1/notifications', {
        params: { query: { cursor: pageParam, limit: PAGE_SIZE } },
        signal,
      });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
  });
}
