import { createSupabaseServiceClient } from '@/lib/supabase/service';

interface CreateNotificationParams {
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  createdBy?: string | null;
  recipientUserIds: string[];
}

export async function createNotification({
  type,
  title,
  message,
  entityType,
  entityId,
  createdBy,
  recipientUserIds,
}: CreateNotificationParams): Promise<void> {
  if (recipientUserIds.length === 0) return;

  const supabase = createSupabaseServiceClient();

  const { data: notif, error: notifError } = await supabase
    .from('notifications')
    .insert({
      type,
      title,
      message,
      entity_type: entityType || null,
      entity_id: entityId || null,
      created_by: createdBy || null,
    })
    .select('id')
    .single();

  if (notifError || !notif) {
    console.error('Error creating notification:', notifError);
    return;
  }

  const uniqueRecipients = Array.from(new Set(recipientUserIds));

  const { error: recipientsError } = await supabase.from('notification_recipients').insert(
    uniqueRecipients.map((user_id) => ({
      notification_id: notif.id,
      user_id,
    }))
  );

  if (recipientsError) {
    console.error('Error creating notification recipients:', recipientsError);
  }
}
