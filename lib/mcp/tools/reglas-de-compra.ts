import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { loadPurchaseRules } from '@/lib/orders/purchase-rules';
import { failure } from '../buyer';
import { ok } from '../result';

export function registerReglasDeCompra(server: McpServer) {
  server.registerTool(
    'reglas_de_compra',
    {
      title: 'Reglas de compra',
      description:
        'Las reglas para armar un pedido, sin teléfono: el valor mínimo de compra, cuántas tiendas caben en un pedido, que solo se juntan ' +
        'tiendas de la misma plaza, el máximo por pedido de las ofertas y, por plaza, cómo sale un pedido de varias tiendas.',
      inputSchema: z.object({
        plaza: z.string().max(80).optional().describe('Nombre de una plaza para ver solo la suya. Sin él, todas las activas.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ plaza }) => {
      try {
        const r = await loadPurchaseRules(createSupabaseServiceClient() as any, plaza);
        return ok({
          minimo_de_compra: r.minimumOrder,
          maximo_tiendas_por_pedido: r.maxStoresPerOrder,
          misma_plaza: r.sameMarketplaceOnly,
          ofertas: r.offers,
          plazas: r.marketplaces.map((m) => ({ nombre: m.name, varias_tiendas: m.multiStore, como_sale: m.howItLeaves })),
        });
      } catch (error) {
        return failure(error);
      }
    }
  );
}
