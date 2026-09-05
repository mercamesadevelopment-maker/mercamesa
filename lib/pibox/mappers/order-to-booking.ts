import type { SupabaseClient } from '@supabase/supabase-js';
import { getPiboxDefaultPackageSizeCd, getPiboxServiceTypeId } from '../client';
import { toPiboxCityCode, toSubUnits } from '../constants';
import type { PiboxBookingEnvelope } from '../types';

/**
 * Error de datos faltantes previo a llamar a Pibox. Se separa de los errores
 * de la API para que las rutas puedan responder 400 (dato del negocio
 * incompleto) en vez de 502 (falló el proveedor).
 */
export class PiboxDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PiboxDataError';
  }
}

export interface BookingContext {
  storeOrderId: string;
  /** Código legible del pedido (MM-2026-001017-1): es la referencia que ve el mensajero. */
  code: string;
  subtotal: number;
  orderTotal: number;
  paymentStatus: string;
  notes: string | null;
  store: {
    name: string;
    phone: string | null;
  };
  /** Punto de recogida: la plaza donde está el local */
  origin: {
    address: string;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
  };
  destination: {
    addressLine: string;
    neighborhood: string | null;
    municipality: string;
    latitude: number | null;
    longitude: number | null;
  };
  customer: {
    fullName: string;
    email: string | null;
    phone: string | null;
  };
}

/**
 * Carga de la base todo lo que Pibox necesita para un store_order.
 *
 * El origen es la plaza (`marketplaces`) y no la tienda, porque `stores` no
 * guarda dirección ni coordenadas: el local vive físicamente dentro de la plaza.
 */
export async function loadBookingContext(
  supabase: SupabaseClient<any>,
  storeOrderId: string
): Promise<BookingContext> {
  const { data, error } = await supabase
    .from('store_orders')
    .select(
      `
      id,
      code,
      subtotal,
      notes,
      stores ( name, phone, marketplaces ( address, latitude, longitude, city ) ),
      orders (
        total,
        payment_status,
        delivery_addresses ( address_line, neighborhood, municipality, latitude, longitude ),
        profiles ( full_name, email, phone )
      )
    `
    )
    .eq('id', storeOrderId)
    .single();

  if (error || !data) {
    throw new PiboxDataError(error?.message || 'No se encontró el pedido de la tienda');
  }

  const row = data as any;
  const store = row.stores;
  const marketplace = store?.marketplaces;
  const order = row.orders;
  const address = order?.delivery_addresses;
  const buyer = order?.profiles;

  if (!store) throw new PiboxDataError('El pedido no tiene tienda asociada');
  if (!marketplace?.address) {
    throw new PiboxDataError(
      `La plaza de "${store.name}" no tiene dirección registrada; sin ella el mensajero no sabe dónde recoger.`
    );
  }
  if (!order) throw new PiboxDataError('El pedido de tienda no tiene orden asociada');
  if (!address?.address_line) {
    throw new PiboxDataError('La orden no tiene dirección de entrega registrada');
  }

  return {
    storeOrderId: row.id,
    code: row.code,
    subtotal: Number(row.subtotal || 0),
    orderTotal: Number(order.total || 0),
    paymentStatus: order.payment_status,
    notes: row.notes ?? null,
    store: { name: store.name, phone: store.phone ?? null },
    origin: {
      address: marketplace.address,
      latitude: marketplace.latitude ?? null,
      longitude: marketplace.longitude ?? null,
      city: marketplace.city ?? null,
    },
    destination: {
      addressLine: address.address_line,
      neighborhood: address.neighborhood ?? null,
      municipality: address.municipality,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
    },
    customer: {
      fullName: buyer?.full_name || 'Cliente',
      email: buyer?.email ?? null,
      phone: buyer?.phone ?? null,
    },
  };
}

/**
 * Carga el mismo contexto pero SIN pedido: para cotizar en el carrito, cuando
 * todavía no existe ni la orden ni el `store_order`.
 *
 * `loadBookingContext` parte de un `store_order_id`, así que no sirve antes de
 * la compra. Acá se arma el contexto desde la tienda y la dirección de entrega,
 * y el resto del camino (`buildBookingPayload` → `estimateBooking`) se reutiliza
 * tal cual, de modo que lo que se cotiza es exactamente lo que después se
 * reserva.
 */
export async function loadQuoteContext(
  supabase: SupabaseClient<any>,
  input: { storeId: string; deliveryAddressId: string; buyerId: string; subtotal: number }
): Promise<BookingContext> {
  const [{ data: store, error: storeError }, { data: address, error: addressError }] =
    await Promise.all([
      supabase
        .from('stores')
        .select('name, phone, marketplaces ( address, latitude, longitude, city )')
        .eq('id', input.storeId)
        .maybeSingle(),
      supabase
        .from('delivery_addresses')
        .select('buyer_id, address_line, neighborhood, municipality, latitude, longitude')
        .eq('id', input.deliveryAddressId)
        .maybeSingle(),
    ]);

  if (storeError) throw new PiboxDataError(storeError.message);
  if (addressError) throw new PiboxDataError(addressError.message);
  if (!store) throw new PiboxDataError('La tienda del pedido no existe');
  if (!address?.address_line) {
    throw new PiboxDataError('La dirección de entrega seleccionada no existe');
  }
  // La dirección se vuelve a verificar acá aunque la ruta ya lo haga: cotizar con
  // la dirección de otra persona revelaría a dónde vive.
  if (address.buyer_id !== input.buyerId) {
    throw new PiboxDataError('La dirección de entrega no pertenece a este usuario');
  }

  const marketplace = (store as any).marketplaces;
  if (!marketplace?.address) {
    throw new PiboxDataError(
      `La plaza de "${(store as any).name}" no tiene dirección registrada; sin ella no se puede cotizar el domicilio.`
    );
  }

  const { data: buyer } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', input.buyerId)
    .maybeSingle();

  return {
    // Todavía no existe el store_order; estos campos solo viajan en el payload
    // como referencia y no afectan la tarifa.
    storeOrderId: '',
    code: 'COTIZACION',
    subtotal: input.subtotal,
    orderTotal: input.subtotal,
    paymentStatus: 'pending',
    notes: null,
    store: { name: (store as any).name, phone: (store as any).phone ?? null },
    origin: {
      address: marketplace.address,
      latitude: marketplace.latitude ?? null,
      longitude: marketplace.longitude ?? null,
      city: marketplace.city ?? null,
    },
    destination: {
      addressLine: address.address_line,
      neighborhood: address.neighborhood ?? null,
      municipality: address.municipality,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
    },
    customer: {
      fullName: buyer?.full_name || 'Cliente',
      email: buyer?.email ?? null,
      phone: buyer?.phone ?? null,
    },
  };
}

/**
 * Construye el payload de Pibox. Función pura: no toca red ni base de datos.
 *
 * @param requireCustomerPhone si es true (creación real) exige teléfono del
 *   comprador; para cotizar no hace falta porque nadie va a llamar a nadie.
 */
export function buildBookingPayload(
  ctx: BookingContext,
  options: { requireCustomerPhone?: boolean } = {}
): PiboxBookingEnvelope {
  const { requireCustomerPhone = true } = options;

  if (requireCustomerPhone && !ctx.customer.phone) {
    throw new PiboxDataError(
      'El comprador no tiene teléfono registrado y el mensajero necesita poder contactarlo.'
    );
  }

  // Si alguna dirección no tiene coordenadas, Pibox geocodifica usando city_code.
  const originNeedsGeocoding = ctx.origin.latitude === null || ctx.origin.longitude === null;
  const destinationNeedsGeocoding =
    ctx.destination.latitude === null || ctx.destination.longitude === null;
  const needsGeocoding = originNeedsGeocoding || destinationNeedsGeocoding;

  const destinationCityCode = toPiboxCityCode(ctx.destination.municipality);
  const originCityCode = toPiboxCityCode(ctx.origin.city);

  /**
   * `city_code` es uno solo para toda la reserva, así que solo se puede tomar el
   * de la plaza cuando la entrega es en ese mismo municipio.
   *
   * Antes se hacía `destino ?? origen` sin condición, y eso es peligroso: hay
   * direcciones en Sabaneta y Nobsa, que no están en PIBOX_CITY_CODES. Con el
   * fallback, Pibox recibía el código de Medellín y buscaba "Calle 78s #40-211"
   * DENTRO de Medellín — el domicilio salía a un punto equivocado y nadie se
   * enteraba. Es preferible rechazar y pedir las coordenadas.
   */
  const cityCode = destinationNeedsGeocoding
    ? destinationCityCode
    : destinationCityCode ?? originCityCode;

  if (needsGeocoding && !cityCode) {
    const municipality = ctx.destination.municipality || 'la dirección de entrega';
    throw new PiboxDataError(
      `La dirección de entrega no tiene ubicación en el mapa y "${municipality}" no es una ciudad que Pibox pueda geocodificar. Marca el punto en el mapa para poder despachar.`
    );
  }

  // Contra entrega: si el pago aún no está aprobado, el mensajero recauda el total.
  const counterDelivery = ctx.paymentStatus !== 'approved';

  return {
    booking: {
      address: ctx.origin.address,
      // Le indica al conductor qué local buscar dentro de la plaza
      secondary_address: ctx.store.name,
      ...(ctx.origin.latitude !== null && ctx.origin.longitude !== null
        ? { lat: Number(ctx.origin.latitude), lon: Number(ctx.origin.longitude) }
        : {}),
      ...(ctx.store.phone
        ? { sender_phone: ctx.store.phone, sender_country_code: '57' }
        : {}),
      requested_service_type_id: getPiboxServiceTypeId(),
      return_to_origin: false,
      requires_a_driver_with_base_money: false,
      scheduled_at: null,
      ...(needsGeocoding && cityCode ? { city_code: cityCode } : {}),
      stops: [
        {
          address: ctx.destination.addressLine,
          ...(ctx.destination.neighborhood
            ? { secondary_address: ctx.destination.neighborhood }
            : {}),
          ...(ctx.destination.latitude !== null && ctx.destination.longitude !== null
            ? {
                lat: Number(ctx.destination.latitude),
                lon: Number(ctx.destination.longitude),
              }
            : {}),
          customer: {
            name: ctx.customer.fullName,
            country_code: '57',
            phone: ctx.customer.phone || '',
            ...(ctx.customer.email ? { email: ctx.customer.email } : {}),
          },
          packages: [
            {
              indications: ctx.notes || 'Pedido Mercamesa',
              declared_value: {
                sub_units: toSubUnits(ctx.subtotal),
                currency: 'COP',
              },
              reference: `Mercamesa ${ctx.code}`,
              counter_delivery: counterDelivery,
              collected_value: counterDelivery
                ? { sub_units: toSubUnits(ctx.orderTotal), currency: 'COP' }
                : null,
              size_cd: getPiboxDefaultPackageSizeCd(),
            },
          ],
        },
      ],
    },
  };
}
