import { describe, expect, it } from 'vitest';
import { chatOrderKey } from '@/lib/orders/chat-order';
import { applyInventoryFilter, toInventoryItem, type InventoryRow } from '@/lib/store-products/store-inventory';
import { cambioDePrecio, matchProductRefs } from './tools/escritura';
import { toInventoryView } from './views';

describe('crear_orden', () => {
  it('la llave del pedido lleva al comprador: la de una persona nunca encuentra el pedido de otra', () => {
    expect(chatOrderKey('comprador-a', 'llave-1')).toBe('mcp:comprador-a:llave-1');
    expect(chatOrderKey('comprador-a', 'llave-1')).not.toBe(chatOrderKey('comprador-b', 'llave-1'));
  });
});

describe('actualizar_precio: el producto por su id o su código', () => {
  const ID_A = '11111111-1111-4111-8111-111111111111';
  const ID_B = '22222222-2222-4222-8222-222222222222';
  // Las filas ya vienen filtradas por la tienda del tendero.
  const filas = [
    { id: ID_A, code: 'MM-000123' },
    { id: ID_B, code: 'HUEVO-AA' },
  ];

  it('lleva uno de los dos, no ninguno ni ambos', () => {
    expect(cambioDePrecio.safeParse({ id: ID_A, precio: 1000 }).success).toBe(true);
    expect(cambioDePrecio.safeParse({ codigo: 'MM-000123', precio: 1000 }).success).toBe(true);
    expect(cambioDePrecio.safeParse({ precio: 1000 }).success).toBe(false);
    expect(cambioDePrecio.safeParse({ id: ID_A, codigo: 'MM-000123' }).success).toBe(false);
  });

  it('encuentra por id o por código sin importar mayúsculas, en el orden pedido', () => {
    expect(matchProductRefs([{ codigo: ' huevo-aa ' }, { id: ID_A }], filas)).toEqual({ ok: true, rows: [filas[1], filas[0]] });
  });

  it('un id o un código que no es de la tienda no existe', () => {
    const r = matchProductRefs([{ id: '33333333-3333-4333-8333-333333333333' }, { codigo: 'MM-999' }], filas);
    expect(r).toMatchObject({ ok: false, code: 'NO_EXISTE' });
    expect('message' in r && r.message).toMatch(/33333333-3333-4333-8333-333333333333, MM-999/);
  });

  it('el mismo producto dos veces (por id y por código) no pasa', () => {
    expect(matchProductRefs([{ id: ID_A }, { codigo: 'mm-000123' }], filas)).toMatchObject({ ok: false, code: 'DATOS_INVALIDOS' });
  });
});

describe('inventario_del_tendero', () => {
  const fila = (over: Partial<InventoryRow>): InventoryRow => ({
    id: 'p1',
    code: 'MM-000777',
    price_per_unit: '0.00',
    wholesale_price: null,
    wholesale_min_qty: null,
    stock: '0',
    is_active: false,
    catalog_products: { name: 'Huevo de aldana', categories: { name: 'Huevos' } },
    measurement_units: { abbreviation: 'und' },
    ...over,
  });

  it('el producto de grupo que llega en $0 sale sin publicar y esperando precio, con id y código', () => {
    const v = toInventoryView(toInventoryItem(fila({})));
    expect(v).toEqual({
      id: 'p1',
      codigo: 'MM-000777',
      nombre: 'Huevo de aldana',
      categoria: 'Huevos',
      unidad: 'und',
      precio: 0,
      precio_mayorista: null,
      minimo_mayorista: null,
      existencias: 0,
      publicado: false,
      falta_precio: true,
    });
    expect(toInventoryItem(fila({ price_per_unit: '5000.00', is_active: true })).needsPrice).toBe(false);
  });

  it('cada filtro, en la consulta', () => {
    const llamadas: string[] = [];
    const q: any = {
      eq: (c: string, v: unknown) => (llamadas.push(`eq ${c} ${v}`), q),
      lte: (c: string, v: unknown) => (llamadas.push(`lte ${c} ${v}`), q),
    };
    for (const f of ['todos', 'sin_publicar', 'sin_precio', 'sin_stock'] as const) applyInventoryFilter(q, f);
    expect(llamadas).toEqual(['eq is_active false', 'lte price_per_unit 0', 'lte stock 0']);
  });
});
