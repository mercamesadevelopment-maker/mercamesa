import { Database } from '@/types/database_generated';

export type CategoryRow = Database['public']['Tables']['categories']['Row'] & {
  parent?: { name: string } | null;
};

export type CategoryInsert = Omit<Database['public']['Tables']['categories']['Insert'], 'id' | 'created_at'>;
export type CategoryUpdate = Partial<CategoryInsert>;

export type MeasurementUnitRow = Database['public']['Tables']['measurement_units']['Row'];
export type MeasurementUnitInsert = Omit<Database['public']['Tables']['measurement_units']['Insert'], 'id'>;
export type MeasurementUnitUpdate = Partial<MeasurementUnitInsert>;

export type ModuleRow = Database['public']['Tables']['modules']['Row'] & {
  parent?: { label: string } | null;
};
export type ModuleInsert = Omit<Database['public']['Tables']['modules']['Insert'], 'id' | 'created_at'>;
export type ModuleUpdate = Partial<ModuleInsert>;

export type DocumentTypeRow = Database['public']['Tables']['document_types']['Row'];
export type DocumentTypeInsert = Omit<Database['public']['Tables']['document_types']['Insert'], 'id' | 'created_at'>;
export type DocumentTypeUpdate = Partial<DocumentTypeInsert>;

export type StoreCategoryRow = Database['public']['Tables']['store_categories']['Row'];
export type StoreCategoryInsert = Omit<Database['public']['Tables']['store_categories']['Insert'], 'id' | 'created_at'>;
export type StoreCategoryUpdate = Partial<StoreCategoryInsert>;

export type OrderMinPriceHistoryRow = Database['public']['Tables']['order_min_price_history']['Row'] & {
  profiles?: { full_name: string } | null;
};
export type OrderMinPriceHistoryInsert = Pick<
  Database['public']['Tables']['order_min_price_history']['Insert'],
  'min_price' | 'notes'
>;
