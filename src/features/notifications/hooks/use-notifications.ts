'use client';

import { useCallback } from 'react';
import { useApp } from '@/src/store';
import { notificationsService } from '../services/notifications.service';

export function useNotifications() {
  const { state, dispatch } = useApp();

  const fetchNotifications = useCallback(async () => {
    try {
      const notifs = await notificationsService.getAll();
      dispatch({ type: 'SET_NOTIFS', notifs });
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [dispatch]);

  const markRead = useCallback(
    async (id: string) => {
      dispatch({ type: 'READ_NOTIF', notifId: id });
      try {
        await notificationsService.markRead(id);
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    },
    [dispatch]
  );

  const markAllRead = useCallback(async () => {
    dispatch({ type: 'READ_ALL_NOTIFS' });
    try {
      await notificationsService.markAllRead();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [dispatch]);

  return {
    notifs: state.notifs,
    fetchNotifications,
    markRead,
    markAllRead,
  };
}
