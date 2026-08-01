import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/lib/api';
import { reportError } from '@/lib/report-error';
import { isUnread, type Notification } from '../notification';
import { myNotificationsQuery } from './use-my-notifications';
import { unreadCountQuery } from './use-unread-count';

/**
 * Reading a notification is a side effect of opening it, not an action the reader asked for — so it
 * never toasts and never stands in the way of the navigation the click was really about. There is
 * no mark-all counterpart, deliberately: the API cannot do one atomically.
 */
export function useOpenNotification() {
  const queryClient = useQueryClient();

  const { mutate } = api.useMutation('post', '/v1/notifications/{notification_id}/read', {
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: unreadCountQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: myNotificationsQuery.queryKey }),
      ]);
    },
    onError: (error) => reportError(error, { boundary: 'widget', source: 'Notifications' }),
  });

  return useCallback(
    (notification: Notification) => {
      if (!isUnread(notification)) return;
      mutate({ params: { path: { notification_id: notification.id } } });
    },
    [mutate],
  );
}
