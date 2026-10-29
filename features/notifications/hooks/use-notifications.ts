'use client';

import { useCallback } from 'react';
import { useNotificationsState } from '../notifications-context';
import { notificationsService } from '../services/notifications.service';

export function useNotifications() {
  const { notifs, setNotifs } = useNotificationsState();

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifs(await notificationsService.getAll());
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [setNotifs]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      try {
        await notificationsService.markRead(id);
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    },
    [setNotifs]
  );

  const markAllRead = useCallback(async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsService.markAllRead();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [setNotifs]);

  return {
    notifs,
    fetchNotifications,
    markRead,
    markAllRead,
  };
}
