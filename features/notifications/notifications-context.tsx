'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import type { AppNotification } from '@/features/notifications/types/notification.types';

interface NotificationsContextValue {
  notifs: AppNotification[];
  setNotifs: React.Dispatch<React.SetStateAction<AppNotification[]>>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/** Las notificaciones de la campana. Las carga y las marca `useNotifications()`. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const value = useMemo(() => ({ notifs, setNotifs }), [notifs]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsState(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotificationsState must be used within NotificationsProvider');
  return context;
}
