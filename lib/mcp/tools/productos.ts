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
 * La vitrina pública, con el mismo cliente que un visitante sin sesión: Carolina
 * ve exactamente lo que vería cualquiera en la página.
 */
export function registerProductos(server: McpServer) {
  server.registerTool(
    'buscar_productos',
    {
      title: 'Buscar productos',
      description:
        'Busca en la vitrina pública de MercaMesa: productos publicados con su tienda, plaza, precio, oferta vigente y existencias. ' +
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
        const r = await listStorefront(createSupabaseStatelessClient() as any, params, tienda_id ?? null);
        return ok({
          productos: r.data.map(toProductView),
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
        const r = await listStorefront(createSupabaseStatelessClient() as any, params, null);
        if (r.data.length === 0) return fail('NO_EXISTE', 'Ese producto no está publicado.');
        return ok({ producto: toProductView(r.data[0]) });
      } catch (error) {
        return failure(error);
      }
    }
  );
}
