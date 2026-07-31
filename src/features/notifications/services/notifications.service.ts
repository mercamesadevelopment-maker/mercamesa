import { AppNotification } from '@/src/types';

interface NotificationRecipientRow {
  id: string;
  read_at: string | null;
  created_at: string;
  notifications: {
    id: string;
    type: string;
    title: string;
    message: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
  } | null;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Justo ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

function mapRow(row: NotificationRecipientRow): AppNotification {
  return {
    id: row.id,
    type: (row.notifications?.type as AppNotification['type']) || 'order_new',
    title: row.notifications?.title || '',
    msg: row.notifications?.message || '',
    time: timeAgo(row.notifications?.created_at || row.created_at),
    read: !!row.read_at,
    entityType: row.notifications?.entity_type ?? null,
    entityId: row.notifications?.entity_id ?? null,
  };
}

export const notificationsService = {
  async getAll(): Promise<AppNotification[]> {
    const res = await fetch('/api/notifications');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error fetching notifications');
    return ((json.data || []) as NotificationRecipientRow[]).map(mapRow);
  },

  async markRead(id: string): Promise<void> {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? 'Error marking notification as read');
    }
  },

  async markAllRead(): Promise<void> {
    const res = await fetch('/api/notifications/read-all', { method: 'PUT' });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? 'Error marking all notifications as read');
    }
  },
};
