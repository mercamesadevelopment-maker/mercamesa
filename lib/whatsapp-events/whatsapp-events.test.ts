import { describe, expect, it } from 'vitest';
import { toOrderDetail, type DetailRows } from '@/lib/orders/buyer-orders';
import { toAviso, toPickupCodeAviso, type BookingCodes } from './build-payload';
import {
  avisoId,
  FEED_MAX_LIMIT,
  lineaFor,
  pickupHandlerRole,
  feedWindow,
  isNotifiable,
  nextCursor,
  parseFeedQuery,
  skipReason,
  type EventRow,
  type Recipient,
} from './rules';

const q = (s: string) => parseFeedQuery(new URLSearchParams(s));

describe('consulta de avisos: parámetros', () => {
  it('sin nada empieza en 0 con el límite por defecto', () => {
    expect(q('')).toEqual({ desde: 0, limite: 50 });
    expect(q('desde=1234&limite=100')).toEqual({ desde: 1234, limite: 100 });
  });

  it('rechaza un cursor o un límite que no son números, y un límite fuera de rango', () => {
    for (const malo of ['desde=-1', 'desde=abc', 'limite=0', `limite=${FEED_MAX_LIMIT + 1}`, 'limite=1.5']) {
      expect(q(malo)).toHaveProperty('error');
    }
  });
});

describe('consulta de avisos: cursor', () => {
  const ahora = new Date('2026-11-05T15:00:00Z');

  it('deja 5 segundos de margen, y la primera consulta solo trae la última hora', () => {
    expect(feedWindow(0, ahora)).toEqual({ desdeFecha: '2026-11-05T14:00:00.000Z', hasta: '2026-11-05T14:59:55.000Z' });
    expect(feedWindow(10, ahora).desdeFecha).toBeNull();
  });

  it('avanza hasta el último evento leído, y sin eventos se queda donde estaba', () => {
    expect(nextCursor(10, [{ seq: 11 }, { seq: 14 }, { seq: 12 }])).toBe(14);
    expect(nextCursor(10, [])).toBe(10);
  });
});

describe('qué se avisa', () => {
  const ev = (event_type: EventRow['event_type'], status_to: string | null = null) => ({ event_type, status_to });

  it('pedido de una tienda: todo', () => {
    for (const s of ['packing', 'at_collection', 'dispatched', 'delivered', 'cancelled']) {
      expect(isNotifiable(ev('parte_estado', s), 'store')).toBe(true);
    }
  });

  it('pedido de varias tiendas: sin los estados intermedios de cada parte', () => {
    for (const s of ['packing', 'at_collection', 'dispatched']) expect(isNotifiable(ev('parte_estado', s), 'consolidated')).toBe(false);
    for (const s of ['delivered', 'cancelled', 'returned']) expect(isNotifiable(ev('parte_estado', s), 'consolidated')).toBe(true);
    expect(isNotifiable(ev('pedido_confirmado'), 'consolidated')).toBe(true);
    expect(isNotifiable(ev('domicilio_en_camino'), 'consolidated')).toBe(true);
  });

  it('solo a compradores activos con el teléfono verificado y los avisos encendidos', () => {
    const r: Recipient = { full_name: 'Ana', phone: '+573001112233', phone_verified_at: '2026-11-04', whatsapp_notifications: true, is_active: true };
    expect(skipReason(r)).toBeNull();
    expect(skipReason(null)).toBe('sin_cuenta');
    expect(skipReason({ ...r, is_active: false })).toBe('sin_cuenta');
    expect(skipReason({ ...r, phone_verified_at: null })).toBe('sin_telefono_verificado');
    expect(skipReason({ ...r, whatsapp_notifications: false })).toBe('avisos_apagados');
  });
});

describe('el aviso', () => {
  const rows: DetailRows = {
    order: {
      id: 'o1', code: 'MM-2026-000100', created_at: '2026-11-05T14:00:00Z', status: 'dispatched', payment_status: 'approved', total: 23000,
      subtotal: 15000, delivery_fee: 8000, service_commission_amount: 0, messages_amount: 0, platform_commission_amount: 0,
      discount: 0, credit_applied: 0, delivery_address_snapshot: { municipality: 'Medellín', neighborhood: 'Laureles', address_line: 'Cra 70 # 1-2' },
    },
    parts: [{ id: 'so1', order_id: 'o1', store_id: 's1', code: 'MM-2026-000100-1', status: 'dispatched', split_index: 1, stores: { name: 'Frutas Ana' } }],
    items: [{ catalog_name: 'Papa criolla', unit_name: 'kg', quantity: 2, unit_price: 5000, total_price: 10000, store_products: { store_id: 's1' } }],
    history: [{ store_order_id: 'so1', status: 'packing', created_at: '2026-11-05T14:10:00Z' }],
    bookings: [{
      booking_id: 'B1', store_order_id: 'so1', status_cd: 6, driver_name: 'Luis', driver_phone: '+573009999999', vehicle_plates: 'ABC123',
      tracking_link: 'https://seguimiento', is_active: true, updated_at: '2026-11-05T14:30:00Z',
      validation_code: '4321', pickup_validation_code: '8765',
    } as any],
  };
  const ev: EventRow = { seq: 7, id: 'e1', event_type: 'domicilio_en_camino', order_id: 'o1', store_order_id: 'so1', status_to: null, created_at: '2026-11-05T14:31:00Z' };
  const r: Recipient = { full_name: 'Ana', phone: '+573001112233', phone_verified_at: '2026-11-04', whatsapp_notifications: true, is_active: true };
  const aviso = toAviso(ev, toOrderDetail(rows), r, 'MM-2026-000100-1');

  it('trae lo que necesita la plantilla', () => {
    expect(aviso).toMatchObject({
      id: 'e1', seq: 7, tipo: 'domicilio_en_camino', linea: 'compradores',
      destinatario: { telefono: '+573001112233', nombre: 'Ana', rol: 'comprador' },
      parte: { codigo: 'MM-2026-000100-1', tienda: 'Frutas Ana' },
      domicilio: { seguimiento: 'https://seguimiento', conductor: 'Luis', placa: 'ABC123' },
    });
    expect(aviso.pedido.codigo).toBe('MM-2026-000100');
    expect(aviso.pedido.partes[0].productos[0]).toMatchObject({ nombre: 'Papa criolla', cantidad: 2, unidad: 'kg' });
  });

  it('fuera de «domicilio recogido» no lleva los códigos del domicilio, el teléfono del conductor ni el historial', () => {
    const texto = JSON.stringify(aviso);
    expect(texto).not.toMatch(/4321|8765|573009999999|historial/);
  });

  it('un cambio de estado lleva el estado nuevo con su texto', () => {
    const cambio = toAviso({ ...ev, event_type: 'parte_estado', status_to: 'delivered' }, toOrderDetail(rows), r, 'MM-2026-000100-1');
    expect(cambio.estado_nuevo).toEqual({ estado: 'delivered', estado_texto: 'Entregado' });
    expect(cambio.domicilio).toBeNull();
  });

  it('«domicilio recogido» le lleva al comprador su código de entrega, y no el de recogida', () => {
    const codes: BookingCodes = { pickup_validation_code: '8765', validation_code: '4321', driver_name: 'Luis', vehicle_plates: 'ABC123' };
    const recogido = toAviso({ ...ev, event_type: 'domicilio_recogido' }, toOrderDetail(rows), r, 'MM-2026-000100-1', codes);
    expect(recogido.domicilio).toMatchObject({ codigo_entrega: '4321', conductor: 'Luis', placa: 'ABC123' });
    expect(JSON.stringify(recogido)).not.toMatch(/8765|573009999999/);
    // El de «en camino» no lo lleva aunque la reserva ya lo tenga.
    expect(toAviso(ev, toOrderDetail(rows), r, 'MM-2026-000100-1', codes).domicilio).not.toHaveProperty('codigo_entrega');
  });
});

describe('códigos de Pibox', () => {
  const sinNada = { runnerRequired: false, logisticsRequired: false };

  it('el código de recogida va a quien entrega el paquete al mensajero', () => {
    expect(pickupHandlerRole('store', { runnerRequired: true, logisticsRequired: true })).toBe('tendero');
    expect(pickupHandlerRole('consolidated', { runnerRequired: true, logisticsRequired: true })).toBe('logistica');
    expect(pickupHandlerRole('consolidated', { runnerRequired: false, logisticsRequired: true })).toBe('logistica');
    expect(pickupHandlerRole('consolidated', { runnerRequired: true, logisticsRequired: false })).toBe('patinador');
    expect(pickupHandlerRole('consolidated', sinNada)).toBe('tendero');
  });

  it('la línea: compradores para el comprador, tenderos para el resto', () => {
    expect(lineaFor('comprador')).toBe('compradores');
    for (const rol of ['tendero', 'logistica', 'patinador'] as const) expect(lineaFor(rol)).toBe('tenderos');
  });

  it('el id de un aviso repartido es un UUID estable, distinto por persona, sin el id de la cuenta', () => {
    const a = avisoId('e1', 'u1');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(avisoId('e1', 'u1')).toBe(a);
    expect(avisoId('e1', 'u2')).not.toBe(a);
    expect(a).not.toContain('u1');
  });

  const booking: BookingCodes = {
    pickup_validation_code: '8765', validation_code: '4321', driver_name: 'Luis', vehicle_plates: 'ABC123',
  };
  const ev: EventRow = { seq: 9, id: 'e9', event_type: 'codigo_recogida', order_id: 'o1', store_order_id: 'so1', status_to: null, created_at: '2026-11-05T14:20:00Z' };
  const tendero = { id: 'u7', rol: 'tendero' as const, full_name: 'Ana', phone: '+573005556677', phone_verified_at: '2026-11-04', whatsapp_notifications: true, is_active: true };

  it('el aviso de recogida trae lo que pidió Meteor y nada del comprador', () => {
    const aviso = toPickupCodeAviso(ev, tendero, {
      orderCode: 'MM-2026-000100', part: { codigo: 'MM-2026-000100-1', tienda: 'Frutas Ana' }, tiendas: ['Frutas Ana'], booking,
    });
    expect(aviso).toMatchObject({
      seq: 9, tipo: 'codigo_recogida', linea: 'tenderos',
      destinatario: { telefono: '+573005556677', nombre: 'Ana', rol: 'tendero' },
      pedido: { codigo: 'MM-2026-000100' },
      parte: { codigo: 'MM-2026-000100-1', tienda: 'Frutas Ana' },
      recogida: { codigo: '8765', conductor: 'Luis', placa: 'ABC123', lugar: 'tienda' },
    });
    expect(aviso.id).toBe(avisoId('e9', 'u7'));
    expect(JSON.stringify(aviso)).not.toMatch(/4321|direccion|valores|u7/);
  });

  it('en la bahía: sin parte, con todas las tiendas, y sin conductor si aún no hay', () => {
    const aviso = toPickupCodeAviso({ ...ev, store_order_id: null }, { ...tendero, rol: 'logistica' }, {
      orderCode: 'MM-2026-000100', part: null, tiendas: ['Frutas Ana', 'Carnes Luis'],
      booking: { ...booking, driver_name: null, vehicle_plates: null },
    });
    expect(aviso.parte).toBeNull();
    expect(aviso.tiendas).toEqual(['Frutas Ana', 'Carnes Luis']);
    expect(aviso.recogida).toEqual({ codigo: '8765', conductor: null, placa: null, lugar: 'bahia' });
    expect(aviso.destinatario.rol).toBe('logistica');
  });
});
