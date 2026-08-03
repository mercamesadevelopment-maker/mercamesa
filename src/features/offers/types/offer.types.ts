import { Database } from '@/types/database_generated';

export type StoreOffer = Database['public']['Tables']['store_offers']['Row'] & {
  imageSignedUrl?: string | null;
  store_products?: {
    id: string;
    store_id: string;
    price_per_unit: number;
    stock: number;
    catalog_products?: {
      name: string;
      image_url: string | null;
    } | null;
    stores?: { name: string } | null;
    measurement_units?: { abbreviation: string } | null;
  } | null;
};
