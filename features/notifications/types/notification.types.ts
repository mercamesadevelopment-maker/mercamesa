export interface AppNotification {
  id: string;
  type: 'order_new' | 'price_update' | 'rating' | 'payment' | 'store_offer_pending' | 'store_offer_reviewed' | 'delivery_update';
  title: string;
  msg: string;
  time: string;
  read: boolean;
  entityType?: string | null;
  entityId?: string | null;
}
