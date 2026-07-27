import type { Database } from '@/types/database_generated';

export type PaymentMethodRow =
  Database['public']['Tables']['buyer_payment_methods']['Row'];

export type PaymentMethodInsert = Omit<
  Database['public']['Tables']['buyer_payment_methods']['Insert'],
  'buyer_id' | 'id' | 'created_at' | 'updated_at'
>;

export type PaymentMethodUpdate =
  Database['public']['Tables']['buyer_payment_methods']['Update'];

export interface PaymentMethodFormValues {
  label: string;
  last4: string;
  exp: string;
  is_default: boolean;
}
