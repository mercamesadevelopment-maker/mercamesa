import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database_generated';
import { listActiveCategories } from './active';

/**
 * Un cliente falso que aplica los filtros `eq` sobre unas filas en memoria y
 * anota la consulta, para ver qué se le pidió a la base.
 */
function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { table?: string; eq: [string, unknown][] } = { eq: [] };
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      calls.eq.push([col, val]);
      return builder;
    },
    order: () => builder,
    range: (from: number, to: number) => {
      const filtered = rows.filter((r) => calls.eq.every(([c, v]) => r[c] === v));
      return Promise.resolve({ data: filtered.slice(from, to + 1), error: null });
    },
  };
  const client = {
    from: (table: string) => {
      calls.table = table;
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

describe('listActiveCategories', () => {
  it('no ofrece las categorías inactivas (había dos «Frutas frescas»)', async () => {
    const { client, calls } = fakeClient([
      { id: 'nueva', name: 'Frutas frescas', is_active: true },
      { id: 'vieja', name: 'Frutas frescas', is_active: false },
      { id: 'otra', name: 'Bebidas', is_active: true },
    ]);

    const result = await listActiveCategories(client);

    expect(calls.table).toBe('categories');
    expect(calls.eq).toContainEqual(['is_active', true]);
    expect(result.map((c) => c.id)).toEqual(['nueva', 'otra']);
  });
});
