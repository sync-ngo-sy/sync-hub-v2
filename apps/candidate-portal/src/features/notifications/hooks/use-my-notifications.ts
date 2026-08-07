import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { NOTIFICATIONS_PAGE_SIZE } from '../notification';

const PAGE = { params: { query: { limit: NOTIFICATIONS_PAGE_SIZE } } };

export const myNotificationsQuery = api.queryOptions('get', '/v1/notifications', PAGE);

export function useMyNotifications() {
  const notifications = api.useInfiniteQuery('get', '/v1/notifications', PAGE, {
    initialPageParam: null,
    getNextPageParam: (page) => page.next_cursor,
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  const { error } = notifications;
  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Notifications' });
  }, [error]);

  return notifications;
}
