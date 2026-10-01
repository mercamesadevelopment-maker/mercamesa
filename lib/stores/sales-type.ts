/**
 * A quién le vende una tienda: al detal, al por mayor o a los dos.
 *
 * Son dos casillas independientes (`is_retail`, `is_wholesale`), no una opción
 * excluyente, y por eso el filtro tampoco lo es: una tienda que vende de las dos
 * formas aparece tanto en «Minorista» como en «Mayorista».
 */
export type SalesTypeFilter = 'all' | 'retail' | 'wholesale';

export interface StoreSalesType {
  is_wholesale?: boolean | null;
  is_retail?: boolean | null;
}

export const SALES_TYPE_OPTIONS: { value: SalesTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'retail', label: 'Minorista' },
  { value: 'wholesale', label: 'Mayorista' },
];

export function matchesSalesType(store: StoreSalesType, filter: SalesTypeFilter): boolean {
  if (filter === 'retail') return Boolean(store.is_retail);
  if (filter === 'wholesale') return Boolean(store.is_wholesale);
  return true;
}

export function salesTypeLabel(store: StoreSalesType): string | null {
  if (store.is_wholesale && store.is_retail) return 'Mayorista y minorista';
  if (store.is_wholesale) return 'Mayorista';
  if (store.is_retail) return 'Minorista';
  return null;
}
