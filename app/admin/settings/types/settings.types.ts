import { Database } from '@/types/database_generated';

/**
 * `product_count` y `child_count` los calcula el listado para poder decir si una
 * categoría se puede borrar **antes** de que alguien lo intente. Son de solo
 * lectura: no viajan en los payloads de guardado.
 */
export type CategoryRow = Database['public']['Tables']['categories']['Row'] & {
  parent?: { name: string } | null;
  product_count?: number;
  child_count?: number;
};

export type CategoryInsert = Omit<Database['public']['Tables']['categories']['Insert'], 'id' | 'created_at'>;
export type CategoryUpdate = Partial<CategoryInsert>;

/** Los `*_count` los calcula el listado para saber si la fila se puede borrar. */
export type MeasurementUnitRow = Database['public']['Tables']['measurement_units']['Row'] & {
  catalog_product_count?: number;
  store_product_count?: number;
};
export type MeasurementUnitInsert = Omit<Database['public']['Tables']['measurement_units']['Insert'], 'id'>;
export type MeasurementUnitUpdate = Partial<MeasurementUnitInsert>;

export type ModuleRow = Database['public']['Tables']['modules']['Row'] & {
  parent?: { label: string } | null;
  child_count?: number;
  /**
   * Los roles con la acción `read` sobre este módulo: los que lo ven en el menú
   * y los únicos que `proxy.ts` deja entrar a su ruta.
   */
  read_roles?: { id: string; name: string; label: string }[];
};
export type ModuleInsert = Omit<Database['public']['Tables']['modules']['Insert'], 'id' | 'created_at'>;
export type ModuleUpdate = Partial<ModuleInsert>;

export type DocumentTypeRow = Database['public']['Tables']['document_types']['Row'] & {
  store_document_count?: number;
};
export type DocumentTypeInsert = Omit<Database['public']['Tables']['document_types']['Insert'], 'id' | 'created_at'>;
export type DocumentTypeUpdate = Partial<DocumentTypeInsert>;

export type StoreCategoryRow = Database['public']['Tables']['store_categories']['Row'] & {
  store_count?: number;
};
export type StoreCategoryInsert = Omit<Database['public']['Tables']['store_categories']['Insert'], 'id' | 'created_at'>;
export type StoreCategoryUpdate = Partial<StoreCategoryInsert>;

export type OrderMinPriceHistoryRow = Database['public']['Tables']['order_min_price_history']['Row'] & {
  profiles?: { full_name: string } | null;
};
export type OrderMinPriceHistoryInsert = Pick<
  Database['public']['Tables']['order_min_price_history']['Insert'],
  'min_price' | 'notes'
>;

export type PricingSettingsRow = Database['public']['Tables']['pricing_settings_history']['Row'] & {
  profiles?: { full_name: string } | null;
};
export type PricingSettingsInsert = Omit<
  Database['public']['Tables']['pricing_settings_history']['Insert'],
  'id' | 'created_at' | 'changed_by'
>;

/** Resultado de crear/verificar en Siigo los productos de servicio. */
export interface EnsureSiigoProductResult {
  code: string;
  name: string;
  status: 'created' | 'already_exists' | 'error';
  error?: string;
}

// El slug lo genera el servidor a partir del nombre, así que no entra en el formulario.
export type PersonTypeRow = Database['public']['Tables']['person_types']['Row'];
export type PersonTypeInsert = Omit<
  Database['public']['Tables']['person_types']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'slug'
>;
export type PersonTypeUpdate = Partial<PersonTypeInsert>;

/** `person_type_ids` es la tabla puente aplanada: a qué personas aplica. */
export type IdentificationTypeRow = Database['public']['Tables']['identification_types']['Row'] & {
  person_type_ids?: string[];
};
export type IdentificationTypeInsert = Omit<
  Database['public']['Tables']['identification_types']['Insert'],
  'id' | 'created_at' | 'updated_at' | 'slug'
> & { person_type_ids?: string[] };
export type IdentificationTypeUpdate = Partial<IdentificationTypeInsert>;
