import { describe, expect, it } from 'vitest';
import { PRODUCT_CODE_UNIQUE_INDEX } from '@/lib/products/product-code';
import { insertErrorMessage, publishNewRows, publishRows } from './publish';
import type { ValidatedNewRow, ValidatedRow } from './types';

const fila = (n: number, productCode = `C-${n}`): ValidatedRow => ({
  row: n,
  code: `slug-${n}`,
  name: `Producto ${n}`,
  productCode,
  catalogProductId: `cat-${n}`,
  unitId: 'u',
  pricePerUnit: 1000,
  stock: 1,
  wholesalePrice: null,
  wholesaleMinQty: null,
  minOrderQty: 1,
});

const nueva = (n: number): ValidatedNewRow => ({
  ...fila(n),
  slug: `nuevo-${n}`,
  siigoId: `S${n}`,
  categoryId: 'cat',
  description: null,
});

/**
 * Un cliente de mentira: un INSERT falla si trae algún código en `malos`.
 * Anota cada INSERT y cada DELETE para ver qué se intentó.
 */
function clienteFalso(malos: string[] = []) {
  const inserts: { tabla: string; filas: number }[] = [];
  const borrados: string[][] = [];
  const cliente = {
    from: (tabla: string) => ({
      insert: async (datos: any) => {
        const filas = Array.isArray(datos) ? datos : [datos];
        inserts.push({ tabla, filas: filas.length });
        const malo = filas.find((f) => malos.includes(f.code));
        return {
          error: malo
            ? { code: '23505', message: `duplicate key value violates unique constraint "${PRODUCT_CODE_UNIQUE_INDEX}"` }
            : null,
        };
      },
      delete: () => ({
        in: async (_: string, ids: string[]) => {
          borrados.push(ids);
          return { error: null };
        },
        eq: async (_: string, id: string) => {
          borrados.push([id]);
          return { error: null };
        },
      }),
    }),
  };
  return { cliente: cliente as any, inserts, borrados };
}

describe('publishRows', () => {
  it('sin errores, un INSERT por bloque', async () => {
    const { cliente, inserts } = clienteFalso();
    const resultado = await publishRows(cliente, 's', [fila(1), fila(2), fila(3)]);
    expect(resultado.map((r) => r.status)).toEqual(['created', 'created', 'created']);
    expect(inserts).toEqual([{ tabla: 'store_products', filas: 3 }]);
  });

  it('si el bloque falla, reintenta fila por fila y solo falla la culpable', async () => {
    const { cliente } = clienteFalso(['C-2']);
    const resultado = await publishRows(cliente, 's', [fila(1), fila(2), fila(3)]);
    expect(resultado.map((r) => r.status)).toEqual(['created', 'failed', 'created']);
    expect(resultado[1].message).toContain('C-2');
  });
});

describe('publishNewRows', () => {
  it('si la tienda no puede publicar uno, se borra el producto del catálogo que se creó para él', async () => {
    const { cliente, borrados } = clienteFalso(['C-2']);
    const resultado = await publishNewRows(cliente, cliente, 's', 'usuario', [nueva(1), nueva(2)]);
    expect(resultado.map((r) => r.status)).toEqual(['created', 'failed']);
    // Primero se deshace el bloque entero; después, en el reintento, solo el que falló.
    expect(borrados).toEqual([['cat-1', 'cat-2'], ['cat-2']]);
  });
});

describe('insertErrorMessage', () => {
  it('un choque de código dice cuál; otro choque, que ya estaba publicado', () => {
    expect(insertErrorMessage(`... "${PRODUCT_CODE_UNIQUE_INDEX}"`, '23505', fila(1, 'AB-1'))).toContain('AB-1');
    expect(insertErrorMessage('otro índice', '23505', fila(1))).toBe(
      'Ya lo tienes publicado (se publicó mientras se procesaba el archivo).'
    );
    expect(insertErrorMessage('se cayó', '08006', fila(1))).toBe('se cayó');
  });
});
