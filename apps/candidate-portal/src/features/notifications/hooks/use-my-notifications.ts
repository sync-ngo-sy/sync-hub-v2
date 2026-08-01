import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { NOTIFICATIONS_PAGE_SIZE } from '../notification';

/** Prefix-matched on purpose: it names the list whatever page size or cursor it is holding. */
export const myNotificationsKey = ['get', '/v1/notifications'] as const;

/**
 * Newest first, a cursor at a time — there are no totals and no page numbers, so the list can
 * only ever be "the newest page, then the next one" (§10). The bell's dropdown reads the first
 * page of this same query, which is why opening it warms the page.
 */
export function useMyNotifications() {
  const notifications = api.useInfiniteQuery(
    'get',
    '/v1/notifications',
    { params: { query: { limit: NOTIFICATIONS_PAGE_SIZE } } },
    {
      // `null`, not absent: the client drops null query params, so the first page asks for no
      // cursor at all — where the library's own default would send `cursor=0`.
      initialPageParam: null,
      getNextPageParam: (page) => page.next_cursor,
      select: (data) => data.pages.flatMap((page) => page.items),
    },
  );

  // Handled in place rather than by a boundary, so this is the one path to the reporting seam
  // (§7.2).
  const { error } = notifications;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Notifications' });
  }, [error]);

  return notifications;
}
