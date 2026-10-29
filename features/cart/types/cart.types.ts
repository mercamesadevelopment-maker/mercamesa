import type { Product } from '@/features/products/types/product.types';

export interface CartItem extends Product {
  qty: number;
  unitId?: string;
  unitName?: string;
  offerId?: string | null;
  offerExpired?: boolean;
  originalOfferPrice?: number;
  /**
   * Precio del inventario antes de la oferta.
   *
   * `retailPrice` llega ya sobrescrito con el precio rebajado, así que sin esto
   * el original se pierde y no hay cómo decirle al comprador cuánto se ahorró.
   * Solo viene cuando hay una oferta vigente aplicada.
   */
  listPrice?: number;
  notes?: string;
}
