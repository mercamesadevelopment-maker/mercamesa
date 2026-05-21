import type { Database } from '@/types/database_generated';

export type DeliveryAddress =
  Database['public']['Tables']['delivery_addresses']['Row'];

export type AddressInsert = Omit<
  Database['public']['Tables']['delivery_addresses']['Insert'],
  'buyer_id' | 'id' | 'created_at'
>;

export type AddressUpdate =
  Database['public']['Tables']['delivery_addresses']['Update'];

export interface AddressFormValues {
  label: string;
  address_line: string;
  neighborhood: string;
  municipality: string;
  department: string;
  is_default: boolean;
}
