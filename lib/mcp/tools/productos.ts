import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { listStorefront } from '@/lib/store-products/storefront';
import { createSupabaseStatelessClient } from '@/lib/supabase/stateless-client';
import { normalizeText } from '@/lib/utils/text';
import { failure } from '../buyer';
import { fail, ok } from '../result';
import { toProductView } from '../views';
import { pagina } from './schemas';

/** Resultados por página de `buscar_productos`: lo justo para un mensaje de chat. */
export const PRODUCTS_PAGE_SIZE = 10;

const uuid = z.string().uuid();

/**
 * El código de cada producto en su tienda. La vista de la vitrina no lo trae;
 * se pide aparte, con el mismo cliente sin sesión: lo publicado se lee igual.
 */
async function codesOf(supabase: any, ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('store_products').select('id, code').in('id', ids);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as { id: string; code: string | null }[]).map((p) => [p.id, p.code]));
}

/**
 * La vitrina pública, con el mismo cliente que un visitante sin sesión: Carolina
 * ve exactamente lo que vería cualquiera en la página.
 */
export function registerProductos(server: McpServer) {
  server.registerTool(
    'buscar_productos',
    {
      title: 'Buscar productos',
      description:
        'Busca en la vitrina pública de MercaMesa: productos publicados con su tienda, plaza, precio, oferta vigente, existencias y ' +
        '`codigo` (el del producto en su tienda). Para el inventario completo de un tendero, inventario_del_tendero. ' +
        'No necesita teléfono.',
      inputSchema: z.object({
        texto: z.string().max(80).optional().describe('Lo que busca el comprador, por ejemplo "papa criolla".'),
        tienda_id: uuid.optional().describe('Solo los de una tienda (el tienda_id de un resultado anterior).'),
        categoria: z.string().max(80).optional().describe('Nombre exacto de la categoría.'),
        pagina,
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ texto, tienda_id, categoria, pagina: page }) => {
      try {
        const params = new URLSearchParams({ page: String(page ?? 1), pageSize: String(PRODUCTS_PAGE_SIZE) });
        if (texto) params.set('search', normalizeText(texto).trim());
        if (categoria) params.set('category', categoria);
        const supabase = createSupabaseStatelessClient() as any;
        const r = await listStorefront(supabase, params, tienda_id ?? null);
        const codigos = await codesOf(supabase, r.data.map((p) => p.id));
        return ok({
          productos: r.data.map((p) => toProductView(p, codigos.get(p.id) ?? null)),
          total: r.count ?? 0,
          pagina: page ?? 1,
          por_pagina: PRODUCTS_PAGE_SIZE,
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    'detalle_producto',
    {
      title: 'Detalle de un producto',
      description: 'Un producto de la vitrina por su id (el de buscar_productos), con su precio y su oferta vigente.',
      inputSchema: z.object({ id: uuid.describe('El id del producto, tal como lo devolvió buscar_productos.') }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '1', product_id: id });
        const supabase = createSupabaseStatelessClient() as any;
        const r = await listStorefront(supabase, params, null);
        if (r.data.length === 0) return fail('NO_EXISTE', 'Ese producto no está publicado.');
        const codigos = await codesOf(supabase, [r.data[0].id]);
        return ok({ producto: toProductView(r.data[0], codigos.get(r.data[0].id) ?? null) });
      } catch (error) {
        return failure(error);
      }
    }
  );
}
