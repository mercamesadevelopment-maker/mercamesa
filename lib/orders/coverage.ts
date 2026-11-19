import type { SupabaseClient } from '@supabase/supabase-js';
import { DeliveryQuoteUnavailableError, quoteDeliveryFee } from '@/lib/pricing/delivery-quote';
import { loadOrderMinPrice } from '@/lib/pricing/settings';
import { openStatus, type BusinessHours } from '@/lib/stores/business-hours';

/**
 * Qué le puede llegar al comprador a una de sus direcciones, para el chat de
 * Meteor (`consultar_cobertura`).
 *
 * No hay zonas propias: una dirección está cubierta desde un punto de recogida
 * si Pibox la cotiza, que es la misma condición que pone el carrito para dejar
 * pagar. Las tiendas que despachan desde la bahía de una plaza comparten punto
 * (`stores.pickup_group`) y por eso se cotiza una vez por punto, no por tienda.
 */

/** Más puntos que esto no se cotizan en una sola consulta: cada uno es una llamada a Pibox. */
export const MAX_PICKUP_POINTS = 15;

export interface CoverageStoreRow {
  id: string;
  name: string;
  pickup_group: string | null;
  business_hours: BusinessHours | null;
  marketplaces: { name: string; is_active: boolean } | null;
}

export interface PickupPoint {
  /** `pickup_group`: `plaza:<id>` o `tienda:<id>`. */
  key: string;
  marketplace: string;
  /** Si sale de la bahía de la plaza o de la dirección propia de una tienda. */
  from: 'plaza' | 'tienda';
  /** La tienda con la que se cotiza: cualquiera del punto da el mismo origen. */
  quoteStoreId: string;
  stores: { name: string; open: boolean; hoursLabel: string }[];
}

/** Agrupa las tiendas por punto de recogida, con si están abiertas ahora. Sin base. */
export function pickupPoints(rows: CoverageStoreRow[], now: Date = new Date()): PickupPoint[] {
  const puntos = new Map<string, PickupPoint>();
  for (const r of rows) {
    if (!r.pickup_group || !r.marketplaces?.is_active) continue;
    const estado = r.business_hours?.length ? openStatus(r.business_hours, now) : null;
    const tienda = {
      name: r.name,
      open: estado?.isOpen ?? false,
      hoursLabel: estado?.label ?? 'Sin horario publicado',
    };
    const punto = puntos.get(r.pickup_group);
    if (punto) punto.stores.push(tienda);
    else
      puntos.set(r.pickup_group, {
        key: r.pickup_group,
        marketplace: r.marketplaces.name,
        from: r.pickup_group.startsWith('plaza:') ? 'plaza' : 'tienda',
        quoteStoreId: r.id,
        stores: [tienda],
      });
  }
  return [...puntos.values()]
    .map((p) => ({ ...p, stores: p.stores.sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
    .sort((a, b) => a.marketplace.localeCompare(b.marketplace, 'es') || a.from.localeCompare(b.from));
}

export interface CoverageResult {
  address: { label: string | null; neighborhood: string | null; municipality: string | null };
  declaredValue: number;
  points: (PickupPoint & { deliveryFee: number | null })[];
  /** Ningún punto se pudo cotizar: Pibox no responde o la dirección no tiene ubicación. */
  noQuote: boolean;
  truncated: boolean;
}

/**
 * La cobertura de una dirección del comprador. `null` si la dirección no existe
 * o no es suya: las dos cosas se responden igual.
 */
export async function loadCoverage(
  service: SupabaseClient<any>,
  buyerId: string,
  addressId: string,
  declaredValue?: number | null
): Promise<CoverageResult | null> {
  const { data: address, error } = await service
    .from('delivery_addresses')
    .select('id, label, neighborhood, municipality')
    .eq('id', addressId)
    .eq('buyer_id', buyerId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la dirección: ${error.message}`);
  if (!address) return null;

  const [{ data: stores, error: storesError }, minimo] = await Promise.all([
    service
      .from('stores')
      .select('id, name, pickup_group, business_hours, marketplaces ( name, is_active )')
      .eq('is_active', true),
    loadOrderMinPrice(service),
  ]);
  if (storesError) throw new Error(`No se pudieron leer las tiendas: ${storesError.message}`);

  // El valor declarado del envío: el que diga quien pregunta o, si no, el mínimo de compra.
  const valor = declaredValue && declaredValue > 0 ? declaredValue : minimo ?? 50000;
  const todos = pickupPoints((stores ?? []) as unknown as CoverageStoreRow[]);
  const puntos = todos.slice(0, MAX_PICKUP_POINTS);

  const tarifas = await Promise.allSettled(
    puntos.map((p) =>
      quoteDeliveryFee(service, { storeId: p.quoteStoreId, deliveryAddressId: addressId, buyerId, subtotal: valor })
    )
  );
  for (const t of tarifas) {
    if (t.status === 'rejected' && !(t.reason instanceof DeliveryQuoteUnavailableError)) throw t.reason;
  }

  const conTarifa = puntos.map((p, i) => ({
    ...p,
    deliveryFee: tarifas[i].status === 'fulfilled' ? (tarifas[i] as PromiseFulfilledResult<number>).value : null,
  }));

  return {
    address: { label: address.label ?? null, neighborhood: address.neighborhood ?? null, municipality: address.municipality ?? null },
    declaredValue: valor,
    points: conTarifa,
    noQuote: conTarifa.length > 0 && conTarifa.every((p) => p.deliveryFee === null),
    truncated: todos.length > puntos.length,
  };
}

export interface BuyerAddress {
  id: string;
  label: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  municipality: string | null;
  isDefault: boolean;
}

/** Las direcciones guardadas del comprador, la predeterminada primero. */
export async function listBuyerAddresses(service: SupabaseClient<any>, buyerId: string): Promise<BuyerAddress[]> {
  const { data, error } = await service
    .from('delivery_addresses')
    .select('id, label, address_line, neighborhood, municipality, is_default, created_at')
    .eq('buyer_id', buyerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`No se pudieron leer las direcciones: ${error.message}`);
  return (data ?? []).map((a: any) => ({
    id: a.id,
    label: a.label ?? null,
    addressLine: a.address_line ?? null,
    neighborhood: a.neighborhood ?? null,
    municipality: a.municipality ?? null,
    isDefault: Boolean(a.is_default),
  }));
}
