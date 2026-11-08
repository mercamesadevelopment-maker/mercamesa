import { describe, expect, it } from 'vitest';
import { bearerFrom, isValidMcpToken, MIN_TOKEN_LENGTH } from './auth';
import { pickProfile } from './identity';
import { toCaseView, toOrderDetailView } from './views';
import { orderCodeFrom, toOrderDetail, toOrderSummaries, type DetailRows, type PartRow } from '@/lib/orders/buyer-orders';
import type { PqrsDetail } from '@/lib/pqrs/types';

const TOKEN = 'x'.repeat(MIN_TOKEN_LENGTH);

describe('token de Meteor', () => {
  it('lee el Bearer con o sin espacios de más', () => {
    expect(bearerFrom(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(bearerFrom(`  bearer   ${TOKEN} `)).toBe(TOKEN);
    expect(bearerFrom(TOKEN)).toBeNull();
    expect(bearerFrom(null)).toBeNull();
  });

  it('solo vale el token exacto, y nunca uno corto aunque coincida', () => {
    expect(isValidMcpToken(TOKEN, TOKEN)).toBe(true);
    expect(isValidMcpToken(TOKEN + 'y', TOKEN)).toBe(false);
    expect(isValidMcpToken('y'.repeat(MIN_TOKEN_LENGTH), TOKEN)).toBe(false);
    expect(isValidMcpToken('corto', 'corto')).toBe(false);
    expect(isValidMcpToken(null, TOKEN)).toBe(false);
    expect(isValidMcpToken(TOKEN, null)).toBe(false);
  });
});

describe('identificar por teléfono', () => {
  const fila = (id: string, verificado = true) => ({
    id,
    full_name: id,
    phone_verified_at: verificado ? '2026-11-04T10:00:00Z' : null,
    roles: { name: 'buyer' },
  });

  it('sin cuenta no identifica, y con dos no elige ninguna', () => {
    expect(pickProfile([])).toMatchObject({ ok: false, code: 'NO_IDENTIFICADO' });
    expect(pickProfile([fila('a'), fila('b')])).toMatchObject({ ok: false, code: 'AMBIGUO' });
    expect(pickProfile([fila('a')])).toEqual(fila('a'));
  });

  it('un teléfono sin verificar no identifica a nadie', () => {
    expect(pickProfile([fila('a', false)])).toMatchObject({ ok: false, code: 'NO_VERIFICADO' });
  });
});

const parte = (over: Partial<PartRow>): PartRow => ({
  id: 'so1',
  order_id: 'o1',
  store_id: 's1',
  code: 'MM-2026-000010-1',
  status: 'packing',
  split_index: 1,
  stores: { name: 'Tienda A' },
  ...over,
});

describe('pedidos del comprador', () => {
  it('el código de una parte lleva al pedido', () => {
    expect(orderCodeFrom('mm-2026-001091-1')).toBe('MM-2026-001091');
    expect(orderCodeFrom(' MM-2026-001091 ')).toBe('MM-2026-001091');
    expect(orderCodeFrom('PQR-2026-000019')).toBeNull();
  });

  it('cada pedido lleva sus partes, en orden y con la etiqueta del estado', () => {
    const [pedido] = toOrderSummaries(
      [{ id: 'o1', code: 'MM-2026-000010', created_at: 'x', status: 'confirmed', payment_status: 'approved', total: 5000 }],
      [
        parte({ id: 'so2', code: 'MM-2026-000010-2', split_index: 2, stores: { name: 'Tienda B' } }),
        parte({}),
        parte({ id: 'otra', order_id: 'o2' }),
      ]
    );
    expect(pedido.statusLabel).toBe('Confirmado');
    expect(pedido.paymentStatusLabel).toBe('Aprobado');
    expect(pedido.parts.map((p) => p.storeName)).toEqual(['Tienda A', 'Tienda B']);
    expect(pedido.parts[0].statusLabel).toBe('Empacando');
  });
});

describe('detalle_pedido no deja salir lo que no va por el chat', () => {
  const rows: DetailRows = {
    order: {
      id: 'o1',
      code: 'MM-2026-000010',
      created_at: 'x',
      status: 'dispatched',
      payment_status: 'approved',
      total: 30000,
      subtotal: 20000,
      delivery_fee: 8000,
      service_commission_amount: 600,
      messages_amount: 0,
      platform_commission_amount: 1400,
      discount: 0,
      credit_applied: 0,
      delivery_address_snapshot: { municipality: 'Medellín', neighborhood: 'Centro', address_line: 'Calle 1' },
    },
    parts: [parte({}), parte({ id: 'so2', store_id: 's2', code: 'MM-2026-000010-2', split_index: 2, stores: { name: 'Tienda B' } })],
    items: [
      { catalog_name: 'Papa', unit_name: 'kg', quantity: 2, unit_price: 5000, total_price: 10000, store_products: { store_id: 's1' } },
      { catalog_name: 'Lulo', unit_name: 'kg', quantity: 1, unit_price: 10000, total_price: 10000, store_products: { store_id: 's2' } },
    ],
    history: [{ store_order_id: 'so1', status: 'dispatched', created_at: 'y' }],
    // Aunque la fila llegara con los códigos y el teléfono, no tienen que salir.
    bookings: [
      {
        booking_id: 'b1',
        store_order_id: 'so1',
        status_cd: 6,
        package_status_cd: null,
        driver_name: 'Conductor',
        driver_phone: '+573009999999',
        vehicle_plates: 'ABC123',
        tracking_link: 'https://seguimiento',
        is_active: true,
        updated_at: 'z',
        validation_code: '4321',
        pickup_validation_code: '8765',
      },
    ],
  };

  const vista = toOrderDetailView(toOrderDetail(rows));

  it('cada tienda ve solo sus productos', () => {
    expect(vista.partes[0].productos.map((p) => p.nombre)).toEqual(['Papa']);
    expect(vista.partes[1].productos.map((p) => p.nombre)).toEqual(['Lulo']);
    expect(vista.partes[1].domicilio).toBeNull();
  });

  it('la reserva de un pedido consolidado vale para todas sus partes', () => {
    const consolidado = toOrderDetailView(
      toOrderDetail({ ...rows, bookings: [{ ...rows.bookings[0], store_order_id: null, order_id: 'o1' }] })
    );
    expect(consolidado.partes.map((p) => p.domicilio?.placa)).toEqual(['ABC123', 'ABC123']);
  });

  it('ni los códigos de entrega o recogida, ni el teléfono del conductor', () => {
    const texto = JSON.stringify(vista);
    expect(texto).not.toMatch(/4321|8765|573009999999/);
    expect(texto).not.toMatch(/validation|phone|telefono/i);
    expect(vista.partes[0].domicilio).toMatchObject({ conductor: 'Conductor', placa: 'ABC123' });
  });

  it('los valores van en los dos conceptos de la factura, sin «servicio»', () => {
    expect(vista.valores).toMatchObject({ productos_de_terceros: 20000, domicilio: 10000, total: 30000 });
    expect(Object.keys(vista.valores).join(' ')).not.toMatch(/servicio|comision/);
  });
});

describe('consultar_caso', () => {
  it('sin mensajes internos, sin nombres de quien atendió y sin adjuntos', () => {
    const caso = toCaseView({
      code: 'PQR-2026-000001',
      reasonLabel: 'Producto en mal estado',
      status: 'in_review',
      outcome: null,
      storeName: 'Tienda A',
      orderCode: 'MM-2026-000010-1',
      createdAt: 'x',
      updatedAt: 'y',
      description: 'Llegó dañado',
      items: [],
      storeResponse: null,
      resolvedAt: null,
      resolutionNotes: null,
      refund: null,
      openedByName: 'Comprador',
      buyerName: 'Comprador',
      attachments: [{ path: 'p', url: 'https://firmada' }],
      messages: [
        { id: '1', authorAs: 'admin', authorName: 'Persona del equipo', body: 'Lo revisamos', isInternal: false, createdAt: 'a', attachments: [] },
        { id: '2', authorAs: 'admin', authorName: 'Persona del equipo', body: 'nota interna', isInternal: true, createdAt: 'b', attachments: [] },
      ],
    } as unknown as PqrsDetail);

    expect(caso.conversacion).toEqual([{ de: 'admin', mensaje: 'Lo revisamos', fecha: 'a' }]);
    const texto = JSON.stringify(caso);
    expect(texto).not.toMatch(/Persona del equipo|nota interna|firmada/);
    expect(caso.estado_texto).toBe('En revisión de MercaMesa');
  });
});
