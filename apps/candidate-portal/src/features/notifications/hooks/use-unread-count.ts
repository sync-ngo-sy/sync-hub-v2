import { useEffect } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';

export const unreadCountQuery = api.queryOptions('get', '/v1/notifications/unread-count');

export const UNREAD_POLL_MS = 60_000;

export function useUnreadCount() {
  const count = api.useQuery('get', '/v1/notifications/unread-count', undefined, {
    refetchInterval: UNREAD_POLL_MS,
  });

  const { refetch, error } = count;
  useEffect(() => {
    const refresh = () => void refetch({ cancelRefetch: false });
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refetch]);

  useEffect(() => {
    if (error) reportError(error, { boundary: 'widget', source: 'Notifications' });
  }, [error]);

  return count;
}
